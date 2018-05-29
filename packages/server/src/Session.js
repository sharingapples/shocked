import uuid from 'uuid/v4';
import WebSocket from 'ws';
import { createParser, PKT_SCOPE_RESPONSE, PKT_RPC_RESPONSE, PKT_ACTION, PKT_EVENT, PKT_RPC_REQUEST, PKT_CALL } from 'shocked-common';
import { findScope } from './scoping';
import Channel from './Channel';

class Session {
  constructor(req, params, ws) {
    this.id = uuid();

    this.req = req;
    this.params = params;

    this.values = {};
    this.cleanUps = {};
    this.scopes = {};
    this.closeListeners = [];
    this.subscriptions = [];

    this.scopes = {};

    this.proxy = null;
    this.ws = ws;

    ws.on('close', () => {
      // Remove all subscriptions
      this.subscriptions.forEach(channelId => Channel.unsubscribe(channelId, this));

      // Trigger all the close listeners
      this.closeListeners.forEach(c => c());

      // Perform all cleanups
      Object.keys(this.cleanUps).forEach((k) => {
        this.cleanUps[k]();
      });
    });
  }

  clearProxy(scopeId) {
    if (this.proxy[scopeId]) {
      const proxy = this.proxy[scopeId];
      delete this.proxy[scopeId];
      proxy.close();
    }
  }

  setupProxy(scopeId, url) {
    const scope = this.scopes[scopeId];
    if (!scope) {
      throw new Error(`Unknown scope ${scopeId}`);
    }

    if (scope.proxy) {
      throw new Error(`A proxy is already setup at ${scopeId}`);
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const proxy = new WebSocket(url);
      proxy.on('close', () => {
        if (!scope.proxy) {
          // The proxy has already been disassociated, no need to do anything
          return;
        }

        // Remove proxy for this scope
        scope.proxy = null;

        // If the proxy disconnects, close the session as well
        // Since this is a very rare case scenario, may occur when
        // the target group scales down or up
        this.close();
      });

      proxy.on('connect', () => {
        // Proxy connection established, we can resolve the proxy
        if (!done) {
          done = true;
          scope.proxy = proxy;
          resolve(proxy);
        }
      });

      proxy.on('error', () => {
        if (!done) {
          done = true;
          reject(proxy);
        }
      });

      // Forward any message received back to the client
      proxy.on('message', (data) => {
        this.ws.send(data);
      });
    });
  }

  activate(ws) {
    const parser = createParser();
    parser.onScopeRequest = (tracker, scopeId, manifest) => {
      let scope = this.scopes[scopeId];

      if (!scope) {
        scope = findScope(scopeId);
        if (!scope) {
          return this.send(PKT_SCOPE_RESPONSE(tracker, false, `Unknown scope ${scopeId}`));
        }

        // Store the scope on the session
        this.scopes[scopeId] = scope;

        // Initialize the scope for this session
        scope.init(this);
      }

      if (manifest) {
        return this.send(PKT_SCOPE_RESPONSE(tracker, true, Object.keys(scope.apis)));
      }

      return this.send(PKT_SCOPE_RESPONSE(tracker, true, null));
    };

    parser.onRpcRequest = (tracker, scopeId, api, args) => {
      const apiInstance = { session: this, scope: scopeId };
      const scope = this.scopes[scopeId];
      if (!scope) {
        return this.send(PKT_RPC_RESPONSE(tracker, false, `Unknown api scope ${scopeId}`));
      }

      const fn = scope.apis[api];
      if (!fn) {
        // In case there is proxy available for this scope, then use proxy
        if (scope.proxy) {
          return scope.proxy.send(PKT_RPC_REQUEST(tracker, scopeId, api, args));
        }
        return this.send(PKT_RPC_RESPONSE(tracker, false, `Unknown api ${scopeId}/${api}`));
      }

      return Promise.resolve(fn.apply(apiInstance, args)).then((res) => {
        this.send(PKT_RPC_RESPONSE(tracker, true, res));
      }).catch((err) => {
        this.send(PKT_RPC_RESPONSE(tracker, false, err));
      });
    };

    parser.onCall = (scopeId, api, args) => {
      const apiInstance = { session: this, scope: scopeId };
      const scope = this.scopes[scopeId];
      if (!scope) {
        throw new Error(`Unknown scope ${scopeId}`);
      }

      const fn = scope.apis[api];
      if (!fn) {
        if (scope.proxy) {
          return scope.proxy.send(PKT_CALL(scopeId, api, args));
        }
        throw new Error(`Unknown api ${scopeId}/${api}`);
      }

      // Finally execute the method
      return fn.apply(apiInstance, args);
    };

    ws.on('message', (data) => {
      parser.parse(data);
    });
  }

  close() {
    setImmediate(() => this.ws.close());
  }

  dispatch(action) {
    this.send(PKT_ACTION(action));
  }

  emit(event, data) {
    this.send(PKT_EVENT(event, data));
  }

  scope(name, scoping) {
    if (this.scopes[name]) {
      return this.scopes[name];
    }

    const scope = scoping(this, name);
    this.scopes[name] = scope;
    return scope;
  }

  send(message) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(message);
    }
  }

  subscribe(channelId) {
    if (Channel.subscribe(channelId, this)) {
      this.subscriptions.push(channelId);
    }
  }

  unsubscribe(channelId) {
    if (Channel.unsubscribe(channelId, this)) {
      const idx = this.subscriptions.indexOf(channelId);
      if (idx >= 0) {
        this.subscriptions.splice(idx);
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  channel(id) {
    return new Channel(id);
  }

  set(name, value, onClear) {
    // If there is a previous value, clear that first
    if (this.values[name]) {
      this.clear(name);
    }

    this.values[name] = value;
    if (onClear) {
      this.cleanUps[name] = onClear;
    }
  }

  get(name) {
    if (!this.values[name]) {
      throw new Error(`Session doesn't have a value at ${name}`);
    }

    return this.values[name];
  }

  clear(name) {
    if (!this.values[name]) {
      throw new Error(`Session doesn't have a value at ${name} to clear`);
    }

    const onClear = this.cleanUps[name];
    if (onClear) {
      this.onClear();
      delete this.cleanUps[name];
    }

    delete this.values[name];
  }

  addCloseListener(listener) {
    this.closeListeners.push(listener);
  }

  removeCloseListener(listener) {
    const idx = this.closeListeners.indexOf(listener);
    this.closeListeners.splice(idx, 1);
  }
}

export default Session;
