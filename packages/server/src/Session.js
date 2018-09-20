const {
  createParser,
  PKT_TRACKER_CREATE_FAIL,
  PKT_TRACKER_CREATE_NEW,
  PKT_TRACKER_CREATE_UPDATE,
  PKT_TRACKER_API_RESPONSE,
} = require('shocked-common');
const WebSocket = require('ws');
const debug = require('debug')('shocked');

class Session {
  async onTrackerCreate(group, params, serial) {
    // Do not allow creating multiple trackers on the same group
    // for the same session. Could not think of a use case
    if (this.trackers[group]) {
      return this.send(PKT_TRACKER_CREATE_FAIL(group, 'Another tracker is still open. Multiple trackers on the same group are not allowed for the same session'));
    }

    const tracker = await this.service.createTracker(group, this, params);
    if (!tracker) {
      return this.send(PKT_TRACKER_CREATE_FAIL(group, `Tracker ${group} not recoginized`));
    }

    // Make sure the tracker should serialize, serialization is based on
    // channel
    const serialize = serial && (tracker.channel.id === this.trackerChannels[group]);
    console.log('')

    // Keep this tracker
    this.trackers[group] = tracker;
    this.trackerChannels[group] = tracker.channel.id;

    // Check if the client needs a full refresh or just some actions
    if (serialize) {
      // In case of re-connection it might just be enough to
      // send some missing actions
      const actions = await tracker.getActions(serial);
      if (actions) {
        return this.send(PKT_TRACKER_CREATE_UPDATE(group, await tracker.serial, actions));
      }
    }

    // Looks like the tracker needs to be fully initialized
    const data = await tracker.getData(params);
    const apis = this.service.getTrackerApis(group);
    const pkt = PKT_TRACKER_CREATE_NEW(group, await tracker.serial, data, apis);
    return this.send(pkt);
  }

  async onTrackerApi(group, sn, api, args) {
    try {
      const tracker = this.trackers[group];
      if (!tracker) {
        throw new Error(`Tracker not available for ${group}, may be already closed.`);
      }

      this.service.validateTrackerApi(group, api);
      // const fn = tracker[api];
      const res = await tracker[api](...args);
      return this.send(PKT_TRACKER_API_RESPONSE(group, sn, true, res, tracker.clearParamUpdates()));
    } catch (err) {
      debug(err);
      return this.send(PKT_TRACKER_API_RESPONSE(group, sn, false, err.message));
    }
  }

  async onTrackerClose(group) {
    const tracker = this.trackers[group];
    if (tracker) {
      debug(`Closing tracker ${group}`);
      tracker.close();
      delete this.trackers[group];
    }
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  get(name) {
    return this.data[name];
  }

  constructor(service, ws, inputs) {
    this.service = service;
    this.ws = ws;
    this.uniqueId = 0;
    this.data = inputs;

    // Trackers created for the session
    this.trackers = {};

    // Keep track of the channel, for correcting serialization
    this.trackerChannels = {};

    const parser = createParser();

    parser.onTrackerCreate = this.onTrackerCreate.bind(this);
    parser.onTrackerApi = this.onTrackerApi.bind(this);
    parser.onTrackerClose = this.onTrackerClose.bind(this);

    ws.on('close', () => {
      this.cleanUp();
    });

    ws.on('message', (msg) => {
      parser.parse(msg);
    });
  }

  cleanUp() {
    Object.keys(this.trackers).forEach((trackerName) => {
      this.trackers[trackerName].close();
    });

    this.trackers = null;
    this.trackerChannels = null;
  }
}

module.exports = Session;
