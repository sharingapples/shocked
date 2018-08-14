/**
 * A default channel that works on a single system.
 * For production use consider something like shocked-channel-redis
 */
function configureDefaultChannel({ queueSize = 100 } = {}) {
  return class DefaultChannel {
    constructor(id) {
      this.listeners = [];
      this.id = id;
      this.serialNumber = 0;
      this.actions = [];
    }

    getActions(serial) {
      if (serial > this.serialNumber) {
        // Weird, its not possible to serialize on this scenario
        // This could happen during the server restart
        return null;
      }

      const diff = this.serialNumber - serial;
      if (diff > this.actions.length) {
        console.log('Requesting more than available', diff, this.actions.length);
        // Not enough actions to recreate the whole stuff
        return null;
      }

      return this.actions.slice(this.actions.length - diff);
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

      // Maintain the action queue size
      this.actions.push(action);
      if (this.actions.length > queueSize) {
        this.actions.shift();
        console.log('Maintaining queue size at', this.actions.length);
      }

      const serializedAction = Object.assign({}, action, {
        $serial$: this.serialNumber,
      });

      this.listeners.forEach(listener => listener(serializedAction));
    }

    // async emit(event, data) {
    //   this.sessions.forEach(session => session.emit(event, data));
    // }
  };
}

module.exports = configureDefaultChannel;
