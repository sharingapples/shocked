const {
  PKT_TRACKER_ACTION,
  PKT_TRACKER_EMIT,
  PKT_TRACKER_OPEN,
  PKT_TRACKER_CLOSE,
  initTracker,
} = require('shocked-common');

class Tracker {
  constructor(id, session, params, serial) {
    this.id = id;
    this.session = session;

    this.channel = this.getChannel();

    this.onAction = this.onAction.bind(this);

    Promise.resolve(this.channel.subscribe(this.onAction, serial)).then((token) => {
      if (token !== null) {
        return this.getInitialData().then((initialData) => {
          this.onAction(initTracker(initialData), token);
        });
      }
      return null;
    }).then(() => {
      if (this.isOpen()) {
        if (this.onOpen) {
          this.onOpen();
        }
        this.session.send(PKT_TRACKER_OPEN(this.id));
      }
    });
  }

  isOpen() {
    return this.channel !== null;
  }

  async getChannel() {
    throw new Error(`The tracker ${this.constructor.name} must implement getChannel().`);
  }

  async getInitialData() {
    throw new Error(`The tracker ${this.constructor.name} must implement getInitialData().`);
  }

  onAction(action, serial) {
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_ACTION(this.id, action, serial));
    }
  }

  close() {
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_CLOSE(this.id));
      if (this.onClose) {
        this.onClose();
      }

      this.channel.unsubscribe(this.onAction);
      this.channel = null;
    }
  }

  emit(event, data) {
    if (this.isOpen()) {
      this.session.send(PKT_TRACKER_EMIT(this.id, event, data));
    }
  }

  dispatch(action) {
    if (this.isOpen()) {
      this.channel.publish(action);
    }
  }
}

module.exports = Tracker;
