import uuid from 'uuid/v4';
import WebSocket from 'ws';
import {
  createParser,
  PKT_SCOPE_RESPONSE,
  PKT_RPC_RESPONSE,
  PKT_ACTION,
  PKT_EVENT,
  PKT_RPC_REQUEST,
  PKT_CALL,
  PKT_PROXY_SCOPE_REQUEST,
  PKT_TRACKER_RPC_RESPONSE,
  RPC_SUCCESS_TRACKER,
  RPC_SUCCESS_PROXY,
} from 'shocked-common';
import { getScope } from './scoping';
import Channel from './Channel';
import ProxyApi from './ProxyApi';
import Tracker from './Tracker';

const debug = require('debug')('shocked');

export const EVENT_ACTIVE = 'active';

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
    this.trackers = {};

    this.scopes = {};

    this.proxy = {};
    this.ws = ws;

    ws.on('close', () => {
      // Remove all subscriptions
      this.subscriptions.forEach(channelId => Channel.unsubscribe(channelId, this));

      // Close all proxies
      Object.keys(this.proxy).forEach(id => this.clearProxy(this.proxy[id]));

      // Remove all trackers
      Object.keys(this.trackers).forEach((trackerId) => {
        Channel.unsubscribe(trackerId, this.trackers[trackerId]);
      });

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

      proxy.onerror = () => {
        if (!done) {
          done = true;
          reject(new Error('An error occured on proxy'));
        }
      };

      // Forward any message received back to the client
      proxy.onmessage = (e) => {
        // If the proxy connection has been established, transparently pass the data
        if (done) {
          this.ws.send(e.data);
        } else {
          const proxyParser = createParser();
          proxyParser.onEvent = (event) => {
            // Wait for session to be active before sending in a scope request
            // Session validation might take some time, so the message might
            // be lost, if it is send as soon as the connection is established
            if (event === EVENT_ACTIVE) {
              // the proxy server is active, we can proceed now
              done = true;
              // Resolve with a proxy api and a callback to invoke
              // proxy scope request for the given serial id
              resolve(new ProxyApi((serialId) => {
                proxy.send(PKT_PROXY_SCOPE_REQUEST(serialId, scopeId, true));
              }, proxy));
            }
          };

          proxyParser.parse(e.data);
        }
      };
    });

    return this.proxy[scopeId];
  }

  initScope(scopeId) {
    const scope = this.scopes[scopeId];
    if (scope) {
      return scope;
    }

    const newScope = getScope(scopeId, this);
    if (newScope) {
      this.scopes[scopeId] = newScope;
    }

    return newScope;
  }

  activate(ws) {
    const parser = createParser();
    parser.onProxyScopeRequest = (rpcId, scopeId) => {
      const scope = this.initScope(scopeId);
      if (!scope) {
        return this.send(PKT_RPC_RESPONSE(rpcId, false, `Scope ${scopeId} is not supported by proxy`));
      }

      return this.send(PKT_RPC_RESPONSE(rpcId, RPC_SUCCESS_PROXY, Object.keys(scope)));
    };

    parser.onScopeRequest = (tracker, scopeId, manifest) => {
      const scope = this.initScope(scopeId);

      if (!scope) {
        return this.send(PKT_SCOPE_RESPONSE(tracker, false, `Unknown scope ${scopeId}`));
      }

      if (manifest) {
        return this.send(PKT_SCOPE_RESPONSE(tracker, true, Object.keys(scope)));
      }

      return this.send(PKT_SCOPE_RESPONSE(tracker, true, null));
    };

    parser.onTrackerRpcRequest = async (serialId, trackerId, api, args) => {
      const tracker = this.trackers[trackerId];
      if (!tracker) {
        return this.send(PKT_TRACKER_RPC_RESPONSE(serialId, false, 'Tracker id not found'));
      }

      const fn = await tracker.api[api];
      if (!fn) {
        return this.send(PKT_TRACKER_RPC_RESPONSE(serialId, false, `Tracker doesn't have ${api} api`));
      }

      try {
        const res = await fn(...args);
        return this.send(PKT_TRACKER_RPC_RESPONSE(serialId, true, res));
      } catch (err) {
        return this.send(PKT_TRACKER_RPC_RESPONSE(serialId, false, err));
      }
    };

    parser.onTrackerClose = (trackerId) => {
      const tracker = this.trackers[trackerId];
      if (tracker) {
        Channel.unsubscribe(trackerId, tracker);
        delete this.trackers[trackerId];
      }
    };

    parser.onRpcRequest = async (serialId, scopeId, api, args) => {
      const scope = this.scopes[scopeId];
      if (!scope) {
        return this.send(PKT_RPC_RESPONSE(serialId, false, `Unknown api scope ${scopeId}`));
      }

      const fn = scope[api];
      if (!fn) {
        // In case there is proxy available for this scope, then use proxy
        const proxy = await this.proxy[scopeId];
        if (proxy) {
          return proxy.send(PKT_RPC_REQUEST(serialId, scopeId, api, args));
        }
        return this.send(PKT_RPC_RESPONSE(serialId, false, `Unknown api ${scopeId}/${api}`));
      }

      try {
        const res = await fn(...args);
        if (res instanceof ProxyApi) {
          res.forward(serialId);
          return null;
        } else if (res instanceof Tracker) {
          return this.send(PKT_RPC_RESPONSE(serialId, RPC_SUCCESS_TRACKER, res));
        }
        return this.send(PKT_RPC_RESPONSE(serialId, true, res));
      } catch (err) {
        debug(`RPC Error - ${scopeId}/${api}`, err);
        return this.send(PKT_RPC_RESPONSE(serialId, false, err.message));
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

  createTracker(id, result, api) {
    if (this.trackers[id]) {
      throw new Error(`A tracker with id ${id} already exists. A session cannot have duplicate trackers with same id`);
    }

    const tracker = new Tracker(this, id, result, api);
    this.trackers[id] = tracker;
    Channel.subscribe(id, tracker);
    return tracker;
  }

  tracker(id) {
    return this.channel(id);
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
