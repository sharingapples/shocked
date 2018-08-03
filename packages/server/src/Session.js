import uuid from 'uuid/v4';
import WebSocket from 'ws';
import { createParser, PKT_SCOPE_RESPONSE, PKT_RPC_RESPONSE, PKT_ACTION, PKT_EVENT, PKT_RPC_REQUEST, PKT_CALL, PKT_SCOPE_REQUEST } from 'shocked-common';
import { getScope } from './scoping';
import Channel from './Channel';
import ProxyApi from './ProxyApi';

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

    this.proxy = {};
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

  async clearProxy(scopeId) {
    if (this.proxy[scopeId]) {
      const proxy = await this.proxy[scopeId];
      delete this.proxy[scopeId];
      proxy.close();
    }
  }

  async setupProxy(scopeId, url) {
    const scope = this.scopes[scopeId];
    if (!scope) {
      throw new Error(`Unknown scope ${scopeId}`);
    }

    if (this.proxy[scopeId]) {
      throw new Error(`A proxy is already setup at ${scopeId}`);
    }

    this.proxy[scopeId] = new Promise((resolve, reject) => {
      let done = false;
      const proxy = new WebSocket(url);
      proxy.onclose = () => {
        if (!this.proxy[scopeId]) {
          // The proxy has already been disassociated, no need to do anything
          return;
        }

        // Remove proxy for this scope
        delete this.proxy[scopeId];

        // If the proxy disconnects, close the session as well
        // Since this is a very rare case scenario, may occur when
        // the target group scales down or up
        this.close();
      };

      proxy.onopen = () => {
        // Proxy connection established, we can resolve the proxy
        if (!done) {
          // Send a scope request to get the api's available via proxy
          proxy.send(PKT_SCOPE_REQUEST(1, scopeId, true));
        }
      };

      proxy.onerror = () => {
        if (!done) {
          done = true;
          reject(proxy);
        }
      };

      // Forward any message received back to the client
      proxy.onmessage = (e) => {
        // If the proxy connection has been established, transparently pass the data
        if (done) {
          this.ws.send(e.data);
        } else {
          const proxyParser = createParser();
          proxyParser.onScopeResponse = (tracker, success, result) => {
            done = true;
            if (tracker !== 1) {
              reject(new Error(`Unexpected tracker ${tracker}`));
            } else if (!success) {
              reject(new Error(`Proxy hasn't imlpemented ${scopeId} scope`));
            } else {
              resolve(new ProxyApi(result, proxy));
            }
          };
          proxyParser.parse(e.data);
        }
      };
    });

    return this.proxy[scopeId];
  }

  activate(ws) {
    const parser = createParser();
    parser.onScopeRequest = (tracker, scopeId, manifest) => {
      let scope = this.scopes[scopeId];

      if (!scope) {
        scope = getScope(scopeId, this);
        if (!scope) {
          return this.send(PKT_SCOPE_RESPONSE(tracker, false, `Unknown scope ${scopeId}`));
        }

        // Store the scope on the session
        this.scopes[scopeId] = scope;
      }

      if (manifest) {
        return this.send(PKT_SCOPE_RESPONSE(tracker, true, Object.keys(scope)));
      }

      return this.send(PKT_SCOPE_RESPONSE(tracker, true, null));
    };

    parser.onRpcRequest = async (tracker, scopeId, api, args) => {
      const scope = this.scopes[scopeId];
      if (!scope) {
        return this.send(PKT_RPC_RESPONSE(tracker, false, `Unknown api scope ${scopeId}`));
      }

      const fn = scope[api];
      if (!fn) {
        // In case there is proxy available for this scope, then use proxy
        const proxy = await this.proxy[scopeId];
        if (proxy) {
          return proxy.send(PKT_RPC_REQUEST(tracker, scopeId, api, args));
        }
        return this.send(PKT_RPC_RESPONSE(tracker, false, `Unknown api ${scopeId}/${api}`));
      }

      try {
        const res = await fn(...args);
        if (res instanceof ProxyApi) {
          return this.send(PKT_RPC_RESPONSE(tracker, -1, res.api));
        }
        return this.send(PKT_RPC_RESPONSE(tracker, true, res));
      } catch (err) {
        return this.send(PKT_RPC_RESPONSE(tracker, false, err));
      }
    };

    parser.onCall = async (scopeId, api, args) => {
      const scope = this.scopes[scopeId];
      if (!scope) {
        throw new Error(`Unknown scope ${scopeId}`);
      }

      const fn = scope[api];
      if (!fn) {
        const proxy = await this.proxy[scopeId];
        if (proxy) {
          return proxy.send(PKT_CALL(scopeId, api, args));
        }
        throw new Error(`Unknown api ${scopeId}/${api}`);
      }

      // Finally execute the method
      return fn(...args);
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
      return;
    }

    const onClear = this.cleanUps[name];
    if (onClear) {
      onClear();
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
