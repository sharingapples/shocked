const { PKT_TRACKER_ACTION, PKT_TRACKER_EMIT } = require('shocked-common');

class Tracker {
  constructor(session, params, id) {
    this.session = session;
    this.paramUpdates = params;
    this.id = id;

    this.onAction = this.onAction.bind(this);
  }

  start(channel, channelInstance) {
    this.channel = channel;
    this.channelInstance = channelInstance;

    channelInstance.subscribe(this.onAction);
  }

  onAction(action) {
    this.session.send(PKT_TRACKER_ACTION(this.id, action));
  }

  // eslint-disable-next-line
  onCreate() {
    // Dummy place holder, overrride this method instead of creating constructor
  }

  get serial() {
    return this.channelInstance.getSerial();
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
  async getActions(serial) {
    return this.channelInstance.getActions(serial);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async getData(params) {
    throw new Error('Tracker must implement getData() method');
  }

  close() {
    this.channelInstance.unsubscribe(this.onAction);
  }

  emit(event, data) {
    this.session.send(PKT(this.id, event, data));
  }

  dispatch(action, channel) {
    if (channel && channel !== this.channel) {
      const instance = this.session.service.findChannelInstance(channel);
      if (instance) {
        instance.dispatch(action);
      }
    } else {
      this.channelInstance.dispatch(action);
    }
  }
}

module.exports = Tracker;
