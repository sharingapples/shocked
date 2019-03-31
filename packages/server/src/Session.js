const nanoid = require('nanoid');
const WebSocket = require('ws');
const {
  API, API_RESPONSE, CONTEXT, ACTION, SYNC, IDENTIFIED,
} = require('shocked-common');
const Serializer = require('./Serializer');

class Session {
  constructor(tracker, user, params) {
    this.id = nanoid();
    this.tracker = tracker;

    this.user = user;
    this.params = params;

    this.context = null;
    this.socket = null;
    this.serializer = new Serializer();
    this.unsubscribers = [];

    // Bind all the parser specific callback
    this.onInit = this.onInit.bind(this);
    this.onExecute = this.onExecute.bind(this);
    this.onSync = this.onSync.bind(this);
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // The dispatch method may be called even when there is no connection
  dispatch(action) {
    // If the session cache increases by a large amount, destroy it
    try {
      const serial = this.serializer.push(action);
      if (this.socket) {
        this.send([ACTION, action, serial]);
      }
    } catch (err) {
      this.tracker.destroy(this);
    }
  }

  subscribe(channel, id) {
    const unsub = channel.subscribe(id, this);
    this.unsubscribers.push([unsub, channel, id]);
  }

  unsubscribe(channel, id) {
    for (let i = this.unsubscribers.length - 1; i >= 0; i -= 1) {
      const [unsub, schannel, sid] = this.unsubscribers[i];
      if (channel === schannel && (!id || id === sid)) {
        this.unsubscribers.splice(i, 1);
        unsub();
      }
    }
  }

  unsubscribeAll() {
    for (let i = this.unsubscribers.length - 1; i >= 0; i -= 1) {
      const [unsub] = this.unsubscribers[i];
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  // Serialize with actions available in the server cache
  async sync(serial) {
    const actions = this.serializer.sync(serial);
    this.send([ACTION, actions, this.serializer.getSerial()]);
  }

  getParser(type) {
    if (type === API) return this.onExecute;
    if (type === CONTEXT) return this.onInit;
    if (type === SYNC) return this.onSync;
    return null;
  }

  async onExecute(id, name, payload) {
    const api = this.tracker.api[name];
    try {
      if (!api) throw new Error(`Unknown API ${name}`);
      const result = await api(payload, this);
      this.send([API_RESPONSE, id, false, result]);
    } catch (err) {
      console.error(err);
      this.send([API_RESPONSE, id, true, err.message, err.stack]);
    }
  }

  // Context change request
  async onInit(context) {
    await Promise.all(this.tracker.contextHandlers.map(h => h(context, this)));
  }

  // Action synchronized request
  onSync(serial) {
    this.serializer.synced(serial);
  }

  identified() {
    return this.send([IDENTIFIED, this.id, this.serializer.serial]);
  }

  attach(ws) {
    this.socket = ws;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (!Array.isArray(msg)) throw new Error('Invalid message format');
        const parser = this.getParser(msg[0]);
        if (!parser) throw new Error('Invalid message type');
        parser(...msg.slice(1));
      } catch (err) {
        console.warn(err);
        ws.close(4003, err.message);
      }
    });

    ws.on('close', (code) => {
      this.socket = null;
      if (code < 4000) {
        this.tracker.abandon(this);
      } else {
        this.tracker.destroy(this);
      }
    });
  }

  close(message) {
    if (this.socket) {
      this.socket.close(4003, message);
    }
  }

  set(name, value) {
    Object.defineProperty(this, name, { value, configurable: true, writable: false });
  }
}

module.exports = Session;
