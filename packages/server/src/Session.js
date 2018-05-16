import uuid from 'uuid/v4';
import { executeApi } from './binder';
import Channel from './Channel';

class Session {
  constructor(req, params) {
    this.id = uuid();

    this.req = req;
    this.params = params;

    this.values = {};
    this.cleanUps = {};
    this.scopes = {};
    this.closeListeners = [];
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
        const res = executeApi(this, name, args);
        if (code > 0) {
          ws.send(JSON.stringify([code, res]));
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  close() {
    this.ws.close();
  }

  dispatch(action) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify([0, action]));
    }
  }

  emit(event, data) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify([-1, event, data]));
    }
  }

  scope(name, scoping) {
    if (this.scopes[name]) {
      return this.scopes[name];
    }

    const scope = scoping(this, name);
    this.scopes[name] = scope;
    return scope;
  }

  // eslint-disable-next-line class-methods-use-this
  channel(name) {
    // See if there is already a channel with the given name
    return Channel.get(name);
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

  onClose(listener) {
    this.closeListeners.push(listener);
    return () => {
      const idx = this.closeListeners.indexOf(listener);
      this.closeListeners.splice(idx, 1);
    };
  }
}

export default Session;
