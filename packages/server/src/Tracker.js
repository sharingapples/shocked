const { PKT_TRACKER_ACTION } = require('shocked-common');

class Tracker {
  constructor(session, channel, params, id) {
    this.session = session;
    this.channel = channel;
    this.paramUpdates = params;
    this.id = id;

    this.onAction = this.onAction.bind(this);
    this.channel.subscribe(this.onAction);

    if (this.onCreate) {
      this.onCreate();
    }
  }

  onAction(action) {
    this.session.send(PKT_TRACKER_ACTION(this.id, action));
  }

  // eslint-disable-next-line
  onCreate() {
    // Dummy place holder, overrride this method instead of creating constructor
  }

  get serial() {
    return this.channel.getSerial();
  }

  updateParams(params) {
    Object.assign(this.paramUpdates, params);
  }

  clearParamUpdates() {
    const updates = this.paramUpdates;
    this.paramUpdates = {};
    return updates;
  }

  // Get the actions available from the channel that could
  // update the tracker with the global state of the channel
  async getActions(serialNumber) {
    return this.channel.getActions(serialNumber);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async getData(params) {
    throw new Error('Tracker must implement getData() method');
  }

  close() {
    const n = this.channel.unsubscribe(this.onAction);
    if (n === 0) {
      // Cleanup the channel
      this.session.service.server.clearChannel(this.channel.id);
    }
  }

  dispatch(action) {
    this.channel.dispatch(action);
  }
}

module.exports = Tracker;
