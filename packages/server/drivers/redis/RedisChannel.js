/* eslint-disable no-underscore-dangle */
const fs = require('fs');
const path = require('path');
const { batchActions } = require('shocked-common');

module.exports = function configureRedisChannelDriver(redis, options) {
  const queueSize = (options && options.queueSize) || 100;
  const getActions = fs.readFileSync(path.resolve(__dirname, 'getActions.lua'), 'utf-8');

  const subscriptionMap = {};
  const subscriber = redis.duplicate();

  const driver = {
    getSerialToken(channelId, serialNumber) {
      return { id: channelId, num: serialNumber };
    },

    subscribe(channel, listener) {
      if (!subscriptionMap[channel._id]) {
        subscriptionMap[channel._id] = [listener];
        subscriber.subscribe(channel._id);
      } else {
        subscriptionMap[channel._id].push(listener);
      }
    },

    unsubscribe(channel, listener) {
      const list = subscriptionMap[channel._id];
      if (list) {
        const idx = list.indexOf(listener);
        if (idx >= 0) {
          list.splice(idx, 1);
          if (list.length === 0) {
            delete subscriptionMap[channel];
            subscriber.unsubscribe(channel);
          }
        }
      }
    },

    async publish(channel, action) {
      const transaction = redis.multi();
      const actionStr = JSON.stringify(action);
      transaction.incr(channel._serialKey);
      transaction.rpush(channel._actionsKey, actionStr);
      transaction.ltrim(channel._actionsKey, -queueSize, -1);
      return new Promise((resolve, reject) => {
        transaction.exec((err, res) => {
          if (err) {
            return reject(err);
          }

          const serial = res[0];
          redis.publish(channel._id, JSON.stringify([serial, action]));
          return resolve();
        });
      });
    },
  };

  // eslint-disable-next-line prefer-arrow-callback
  subscriber.on('message', function onMessage(channelId, data) {
    const listeners = subscriptionMap[channelId];
    if (listeners) {
      const [serial, action] = JSON.parse(data);
      listeners.forEach(l => l(action, driver.getSerialToken(channelId, serial)));
    }
  });

  class RedisChannel {
    constructor(channel) {
      this._id = channel;
      this._serialKey = `serial-${this._id}`;
      this._actionsKey = `actions-${this._id}`;
    }

    async subscribe(listener, serialToken) {
      // Subscribe the listener as soon as possible
      driver.subscribe(this, listener);

      const { _serialKey, _id, _actionsKey } = this;
      return new Promise((resolve, reject) => {
        // If no serial token is provided, or the serial token mismatches
        // The token might have been reused from the previous session
        if (!serialToken || serialToken.id !== this._id) {
          return redis.get(_serialKey, (err, res) => {
            if (err) {
              return reject(err);
            }

            return resolve(driver.getSerialToken(_id, parseInt(res, 10) || 0));
          });
        }

        return redis.eval(getActions, 2, _serialKey, _actionsKey, serialToken.num, (e, res) => {
          if (e) {
            return reject(e);
          }

          const serial = res[0];
          const actions = res[1].map(JSON.parse);
          const latestSerialToken = driver.getSerialToken(_id, serial);

          if (!actions) {
            return resolve(latestSerialToken);
          }

          if (actions.length > 0) {
            listener(batchActions(actions), latestSerialToken);
          }

          return resolve(null);
        });
      });
    }

    unsubscribe(listener) {
      driver.unsubscribe(this, listener);
    }

    async publish(action) {
      return driver.publish(this, action);
    }
  }

  // Expose the quit method for closing the redis connections
  RedisChannel.quit = subscriber.quit.bind(subscriber);

  return RedisChannel;
};
