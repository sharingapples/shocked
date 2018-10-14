import EventEmitter from 'events';
import {
  PKT_TRACKER_CLOSE,
  PKT_TRACKER_CREATE,
  PKT_TRACKER_API,
} from 'shocked-common';
import CloseError from './CloseError';
import TimeoutError from './TimeoutError';
import { initStore } from './initStore';
import { batchActions } from './batchActions';

const defaultOptions = {
  timeout: 30000,
};

class TrackerClient extends EventEmitter {
  constructor(store, group, params, destroyer, options = defaultOptions) {
    super();
    this.store = store;
    this.group = group;
    this.params = params;
    this.destroy = destroyer;
    this.apis = null;
    this.serial = null;
    this.options = options;

    this.sn = 0;
    this.calls = [];
  }

  onConnect(client) {
    this.client = client;
    client.send(PKT_TRACKER_CREATE(this.group, this.params, this.serial));
  }

  onDisconnect() {
    this.client = null;

    // The api calls are not expected to be completed now
    // reject them with an error
    if (this.calls.length > 0) {
      const { calls } = this;
      this.calls = [];

      if (calls.length > 0) {
        const err = new CloseError(`Rejecting calls ${calls.length} ${calls.map(c => c.callId).join(',')} due to Connection Termination`);
        calls.forEach(({ reject }) => reject(err));
      }
    }
  }

  onCreate(serial, data, apis) {
    this.serial = serial;

    // Generate api as soon as the tracker is opened
    this.apis = apis.map(name => this.createApi(name));

    this.store.dispatch(initStore(data));

    // Also emit a start event, with the initial data
    this.emit('init', data);
    this.emit('online');
  }

  onUpdate(serial, actions) {
    this.serial = serial;

    this.store.dispatch(batchActions(actions));
    this.emit('online');
  }

  createApi(name) {
    return (...args) => new Promise((resolve, reject) => {
      this.sn += 1;
      const callId = this.sn;
      const pkt = PKT_TRACKER_API(this.group, callId, name, args);
      this.client.send(pkt);

      // Setup a timeout, to cleanup in case a responsee is not
      // received after a long time.
      const timeout = this.options.timeout && setTimeout(() => {
        this.finishApi(callId, false, new TimeoutError(`Api call ${name}[${this.callId}] didn't complete within ${this.options.timeout} ms`));
      }, this.options.timeout);

      // Remember the call
      this.calls.push({
        callId, resolve, reject, timeout,
      });
    });
  }

  finishApi(id, status, response) {
    const idx = this.calls.findIndex(c => c.callId === id);
    if (idx >= 0) {
      const call = this.calls.splice(idx, 1)[0];
      if (status) {
        call.resolve(response);
      } else {
        call.reject(response);
      }
      return true;
    }

    return false;
  }

  onApiResponse(callId, status, response, params) {
    Object.assign(this.params, params);
    this.finishApi(callId, status, response);
  }

  onAction(action) {
    // TODO: Validate serial number, the difference should always be 1
    this.serial = action.$serial$;
    this.store.dispatch(action);
  }

  getApi() {
    return this.apis;
  }

  close() {
    // Make sure the tracker is fully destroyed
    this.destroy();

    // Gracefully close the tracker, if the client is
    // connected;
    if (this.client) {
      this.client.send(PKT_TRACKER_CLOSE(this.group));
    }
  }
}

export default TrackerClient;
