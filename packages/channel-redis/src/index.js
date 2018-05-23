import redis from 'redis';

export default function createProvider(redisOptions) {
  const client = redis.createClient(redisOptions);

  const channels = {};

  client.on('message', (channel, message) => {
    const list = channels[channel];
    if (list) {
      // Forward message to all the subscribed sessions
      list.forEach((session) => {
        session.send(message);
      });
    }
  });

  return {
    // TODO: In case the session is already subscribed return false
    subscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
        // Subscribe to the given channel
        client.subscribe(channelId);
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
        client.unsubscribe(channelId);
      }
      return true;
    },

    publish: (channelId, message) => {
      client.publish(channelId, message);
    },
  };
}
