/**
 * A default channel that works on a single system.
 * For production use consider something like shocked-channel-redis
 */

class DefaultChannel {
  constructor(id) {
    this.listeners = [];
    this.id = id;
    this.serialNumber = 0;
    this.actions = [];
  }

  async getSerial() {
    return this.serialNumber;
  }

  async subscribe(listener) {
    this.listeners.push(listener);
    return this.serialNumber;
  }

  async unsubscribe(listener) {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
    return this.listeners.length;
  }

  async dispatch(action) {
    this.serialNumber += 1;
    const serializedAction = Object.assign({}, action, {
      $serial$: this.serialNumber,
    });

    this.listeners.forEach(listener => listener(serializedAction));
  }

  // async emit(event, data) {
  //   this.sessions.forEach(session => session.emit(event, data));
  // }
}

module.exports = DefaultChannel;
