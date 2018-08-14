const {
  createParser,
  PKT_TRACKER_CREATE_FAIL,
  PKT_TRACKER_CREATE_NEW,
  PKT_TRACKER_CREATE_UPDATE,
  PKT_TRACKER_API_RESPONSE,
} = require('shocked-common');
const WebSocket = require('ws');

class Session {
  async onTrackerCreate(group, channelId, params, serial) {
    // Do not allow creating multiple trackers on the same group
    // for the same session. Could not think of a use case
    if (this.trackers[group]) {
      return this.send(PKT_TRACKER_CREATE_FAIL(group, 'Another tracker is still open. Multiple trackers on the same group are not allowed for the same session'));
    }

    const tracker = await this.service.createTracker(group, channelId, this, params);
    console.log('Tracker created');
    if (!tracker) {
      return this.send(PKT_TRACKER_CREATE_FAIL(group, `Tracker ${group}/${channelId} not recoginized`));
    }

    // Keep this tracker
    this.trackers[group] = tracker;

    // Check if the client needs a full refresh or just some actions
    if (serial) {
      // In case of re-connection it might just be enough to
      // send some missing actions
      const actions = await tracker.getActions(serial);
      if (actions) {
        return this.send(PKT_TRACKER_CREATE_UPDATE(group, tracker.serial, actions));
      }
    }

    // Looks like the tracker needs to be fully initialized
    const data = await tracker.getData(params);
    const pkt = PKT_TRACKER_CREATE_NEW(group, await tracker.serial, data, tracker.getApis());
    return this.send(pkt);
  }

  async onTrackerApiCall(sn, group, id, api, args) {
    const tracker = this.trackers[group];
    if (!tracker) {
      return this.send(PKT_TRACKER_API_RESPONSE(sn, false, 'Tracker is not available, may be already closed.'));
    }

    if (tracker.id !== id) {
      return this.send(PKT_TRACKER_API_RESPONSE(sn, false, 'Tracker mismatch. Please stop this now.'));
    }

    try {
      const res = await tracker.executeApi(api, ...args);
      return this.send(PKT_TRACKER_API_RESPONSE(sn, true, res));
    } catch (err) {
      return this.send(PKT_TRACKER_API_RESPONSE(sn, false, err.message));
    }
  }

  async onTrackerClose(group) {
    const tracker = this.trackers[group];
    if (tracker) {
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

    const parser = createParser();
    console.log('Creating session', service);

    parser.onTrackerCreate = this.onTrackerCreate.bind(this);
    parser.onTrackerApiCall = this.onTrackerApiCall.bind(this);

    ws.on('close', () => {
      this.cleanUp();
    });

    ws.on('message', (msg) => {
      parser.parse(msg);
    });
  }
}

module.exports = Session;
