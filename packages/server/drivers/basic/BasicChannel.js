const { batchActions } = require('shocked-common');

/**
 * A default channel that works on a single system.
 * For production use consider something like shocked-channel-redis
 */
module.exports = function configureBasicChannel({ queueSize = 100 } = {}) {
  // Keep track of all the actions
  const cache = {};

  const driver = {
    getSerialToken(channel, serialNumber) {
      return { id: channel, num: serialNumber };
    },

    subscribe(channel, listener) {
      let obj = cache[channel];
      if (!obj) {
        obj = { serial: 0, actions: [], listeners: [listener] };
        cache[channel] = obj;
      }

      return obj;
    },

    unsubscribe(channel, listener) {
      const obj = cache[channel];
      if (obj) {
        const idx = obj.listeners.indexOf(listener);
        if (idx >= 0) {
          obj.listeners.splice(idx, 1);
          if (obj.listeners.length === 0) {
            delete cache[channel];
          }
        }
      }
    },

    publish(channel, action) {
      const obj = cache[channel];
      if (!obj) {
        console.warn(`Trying to publish on channel ${channel} but don't have any listeners`);
        return;
      }

      // Append the action
      obj.actions.push(action);
      // Make sure the array is within limit
      if (obj.actions.length > queueSize) {
        obj.actions.shift();
      }

      // Increase the serial number
      obj.serial += 1;

      // Dispatch to all the listeners
      const serialToken = this.getSerialToken(channel, obj.serial);
      obj.listeners.forEach(listener => listener(action, serialToken));
    },
  };

  return class BasicChannel {
    constructor(channel) {
      this.id = channel;
    }

    subscribe(listener, serialToken) {
      // Listen via the caching mechanism
      const { serial, actions } = driver.subscribe(this.id, listener);
      const diff = serial - serialToken.num;

      // Get the latest serialization token
      const latestSerialToken = driver.getSerialToken(this.id, serial);
      if (
        serialToken === null // This is the first time the client is connecting
        || serialToken.id !== this.id // looks like the token was forwarded from some other session
        || diff < 0 // Looks like the server restarted and the client is reconnecting
        || diff > actions.length // Not enough actions to sync
      ) {
        return latestSerialToken;
      }

      // Sync all available actions in a batch, only if needed
      if (diff > 0) {
        listener(
          batchActions(diff === actions.length ? actions : actions.slice(actions.length - diff)),
          latestSerialToken
        );
      }

      return null;
    }

    unsubscribe(listener) {
      driver.unsubscribe(this.id, listener);
    }

    publish(action) {
      driver.publish(this.id, action);
    }
  };
};
