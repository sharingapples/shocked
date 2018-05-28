import redis from 'redis';

const port = process.env.REDIS_PORT || 6379;
const host = process.env.REDIS_HOST || 'localhost';

export default function createProvider(options) {
  let pubClient = null;
  let subClient = null;

  const channels = {};

  function getPubClient() {
    if (pubClient !== null) {
      return pubClient;
    }

    pubClient = redis.createClient(port, host, options);
    return pubClient;
  }

  function getSubClient() {
    if (subClient !== null) {
      return subClient;
    }

    subClient = redis.createClient(port, host, options);
    subClient.on('message', (channel, message) => {
      const list = channels[channel];
      if (list) {
        // Forward message to all the subscribed sessions
        list.forEach((session) => {
          session.send(message);
        });
      }
    });
    return subClient;
  }

  return {
    // TODO: In case the session is already subscribed return false
    subscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
        // Subscribe to the given channel
        getSubClient().subscribe(channelId);
        channels[channelId] = [session];
      } else {
        list.push(session);
      }
      return true;
    },

    unsubscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
        return false;
      }

      const idx = list.indexOf(session);
      if (idx === -1) {
        return false;
      }

      list.splice(idx, 1);
      // Cleanup
      if (list.length === 0) {
        delete channels[channelId];
        getSubClient().unsubscribe(channelId);
      }
      return true;
    },

    publish: (channelId, message) => {
      getPubClient().publish(channelId, message);
    },
  };
}
