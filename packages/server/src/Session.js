import uuid from 'uuid/v4';
import WebSocket from 'ws';

import { findApi } from './scoping';
import Channel from './Channel';

import encodeAction from './_encodeAction';
import encodeEvent from './_encodeEvent';

class Session {
  constructor(req, params) {
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
  }

  clearProxy(scopeId) {
    if (this.proxy[scopeId]) {
      const proxy = this.proxy[scopeId];
      delete this.proxy[scopeId];
      proxy.close();
    }
  }

  async setupProxy(scopeId, url) {
    if (this.proxy[scopeId]) {
      throw new Error(`A proxy is already setup at ${scopeId}`);
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const proxy = new WebSocket(url);
      proxy.on('close', () => {
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
      });

      proxy.on('connect', () => {
        // Proxy connection established, we can resolve the proxy
        if (!done) {
          done = true;
          this.proxy[scopeId] = proxy;
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
    this.ws = ws;

    ws.on('close', () => {
      this.closeListeners.forEach(c => c());

      Object.keys(this.cleanUps).forEach((k) => {
        this.cleanUps[k]();
      });
    });

    ws.on('message', (data) => {
      try {
        const p = JSON.parse(data);
        if (!Array.isArray(p)) {
          throw new Error(`Syntax error ${data}`);
        }

        const [code, name, args] = p;
        const [scope, api] = name.split('/', 2);

        // Check if there is a proxy setup for the given scope
        const fn = findApi(scope, api);
        if (!fn) {
          // In case there isn't any api declared, see if we have a proxy
          // for a given scope
          const proxy = this.proxy[scope];
          if (proxy) {
            proxy.send(data);
          } else {
            throw new Error(`Unknown api call ${name}`);
          }
        } else {
          try {
            const res = fn.apply({ session: this, scope }, args);
            if (code > 0) {
              ws.send(JSON.stringify([code, true, res]));
            }
          } catch (err) {
            ws.send(JSON.stringify([code, false, err]));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    });
  }

  close() {
    this.ws.close();
  }

  dispatch(action) {
    this.send(encodeAction(action));
  }

  emit(event, data) {
    this.send(encodeEvent(event, data));
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
    const unsubscribe = Channel.subscribe(channelId, this);
    const remover = this.onClose(unsubscribe);
    return () => {
      remover();
      unsubscribe();
    };
  }

  // eslint-disable-next-line class-methods-use-this
  channel(id) {
    return new Channel(id);
  }

  set(name, value, onClear) {
    if (this.values[name]) {
      throw new Error(`Session already has a value at ${name}`);
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
