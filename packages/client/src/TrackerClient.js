import EventEmitter from 'events';
import { PKT_CLOSE_TRACKER } from 'shocked-common';

class TrackerClient extends EventEmitter {
  constructor(client, { id, result, api }) {
    super();
    console.log('Tracker Client', id, result, api);
    this.id = id;
    this.client = client;
    this.result = result;
    this.api = api.reduce((res, name) => {
      res[name] = (...args) => client.trackerRpc(id, name, args);
      return res;
    }, {});
  }

  get() {
    return this.result;
  }

  update(arg) {
    if (typeof arg === 'function') {
      this.result = arg(this.result);
    } else {
      this.result = arg;
    }
    return this.result;
  }

  close() {
    // Make sure the server closes this channel
    this.client.send(PKT_CLOSE_TRACKER(this.id));

    // And remove it from the client list as well
    this.client.removeTracker(this.id);
  }
}

export default TrackerClient;
