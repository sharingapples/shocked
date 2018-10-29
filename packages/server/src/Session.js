const {
  createParser,
  PKT_TRACKER_CREATE_FAIL,
  PKT_TRACKER_API_RESPONSE,
} = require('shocked-common');
const WebSocket = require('ws');
const debug = require('debug')('shocked');

class Session {
  async onTrackerCreate(group, params, serial) {
    // Do not allow creating multiple trackers on the same group
    // for the same session. Could not think of a use case
    if (this.trackers[group]) {
      this.send(PKT_TRACKER_CREATE_FAIL(group, `Another tracker for ${group} is still open. Multiple trackers on the same group are not allowed for the same session`));
      return;
    }

    const tracker = this.service.createTracker(group, this, params, serial);
    if (!tracker) {
      this.send(PKT_TRACKER_CREATE_FAIL(group, `Tracker ${group} not recoginized`));
      return;
    }

    // Keep this tracker
    this.trackers[group] = tracker;
  }

  async onTrackerApi(group, sn, api, args) {
    const tracker = this.trackers[group];
    try {
      if (!tracker) {
        throw new Error(`Tracker not available for ${group}, may be already closed.`);
      }

      try {
        this.service.validateTrackerApi(group, api);
      } catch (err) {
        if (tracker.onApiRequest) {
          const res = await tracker.onApiRequest(api, args);
          return this.send(PKT_TRACKER_API_RESPONSE(group, sn, true, res));
        }
      }
      // const fn = tracker[api];
      const res = await tracker[api](...args);
      // TODO: Figure out the use of clearParamUpdates and may be deprecate it
      return this.send(PKT_TRACKER_API_RESPONSE(group, sn, true, res, null));
    } catch (err) {
      debug(err);
      if (this.logger) {
        this.logger.error(err);
      }
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

  onTrackerTimestamp(group, timestamp) {
    const tracker = this.trackers[group];
    if (tracker && tracker.updateTimestamp) {
      tracker.updateTimestamp(timestamp);
    }
  }

  /**
   * Allow closing session
   */
  close() {
    setImmediate(() => {
      this.ws.close();
    });
  }

  isAlive() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }

    return false;
  }

  get(name) {
    return this.data[name];
  }

  constructor(service, ws, sessionData, logger) {
    this.service = service;
    this.ws = ws;
    this.logger = logger;
    this.data = sessionData;

    // Trackers created for the session
    this.trackers = {};

    const parser = createParser();

    parser.onTrackerCreate = this.onTrackerCreate.bind(this);
    parser.onTrackerApi = this.onTrackerApi.bind(this);
    parser.onTrackerClose = this.onTrackerClose.bind(this);
    parser.onTrackerTimestamp = this.onTrackerTimestamp.bind(this);

    ws.on('close', () => {
      this.cleanUp();
    });

    ws.on('error', (e) => {
      if (this.logger) {
        this.logger.warn(`Error on session socket ${e.message} - SESSION::${JSON.stringify(this.data, null, 2)}`);
      }
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
  }
}

module.exports = Session;
