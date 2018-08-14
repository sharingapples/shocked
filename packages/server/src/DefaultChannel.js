/**
 * A default channel that works on a single system.
 * For production use consider something like shocked-channel-redis
 */

class DefaultChannel {
  constructor(id) {
    this.sessions = [];
    this.id = id;
    this.serialNumber = 0;
    this.actions = [];
  }

  async getSerial() {
    return this.serialNumber;
  }

  async subscribe(session) {
    this.sessions.push(session);
    return this.serialNumber;
  }

  async unsubscribe(session) {
    const idx = this.sessions.indexOf(session);
    if (idx >= 0) {
      this.sessions.splice(idx, 1);
    }
    return this.sessions.length;
  }

  async dispatch(action) {
    this.serialNumber += 1;
    const serializedAction = Object.assign({}, action, {
      $serial$: this.serialNumber,
    });
    this.sessions.forEach(session => session.dispatch(serializedAction));
  }

  async emit(event, data) {
    this.sessions.forEach(session => session.emit(event, data));
  }
}

module.exports = DefaultChannel;
