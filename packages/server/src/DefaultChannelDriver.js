/**
 * A default channel that works on a single system.
 * For production use consider something like shocked-channel-redis
 */
function configureDefaultChannelDriver({ queueSize = 100 } = {}) {
  const instances = {};

  class Instance {
    constructor(channel) {
      this.channel = channel;
      this.listeners = [];
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
        // Not enough actions to recreate the whole stuff
        return null;
      }

      return this.actions.slice(this.actions.length - diff);
    }

    async getSerial() {
      return this.serialNumber;
    }

    async subscribe(listener) {
      // First subscription, automatically register it
      if (this.listeners.length === 0) {
        if (instances[this.channel.id]) {
          throw new Error(`Channel instance with the same id is already registered ${this.channel.id}`);
        }
        instances[this.channel.id] = this;
      }

      this.listeners.push(listener);
      return this.serialNumber;
    }

    async unsubscribe(listener) {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) {
        this.listeners.splice(idx, 1);
      }
      if (this.listeners.length === 0) {
        delete this.listeners[this.channel.id];
      }
    }

    async dispatch(action) {
      this.serialNumber += 1;

      // Maintain the action queue size
      this.actions.push(action);
      if (this.actions.length > queueSize) {
        this.actions.shift();
      }

      const serializedAction = Object.assign({}, action, {
        $serial$: this.serialNumber,
      });

      this.listeners.forEach(listener => listener(serializedAction));

      // Dispatch to all parent channels recursively
      if (this.channel.parent) {
        const parentInstance = instances[this.channel.parent.id];
        if (parentInstance) {
          parentInstance.dispatch(action);
        }
      }
    }
  }

  return {
    getInstance(channel) {
      const instance = instances[channel.id];
      if (instance) {
        return instance;
      }

      return new Instance(channel);
    },

    findInstance(channel) {
      let ch = channel;
      do {
        const instance = instances[ch.id];
        if (instance) {
          return instance;
        }

        ch = ch.parent;
      } while (ch !== null);
      return null;
    },
  };
}

module.exports = configureDefaultChannelDriver;
