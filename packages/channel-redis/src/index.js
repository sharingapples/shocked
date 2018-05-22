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
    subscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
        // Subscribe to the given channel
        client.subscribe(channelId);
        channels[channelId] = [session];
      } else {
        list.push(session);
      }
    },

    publish: (channelId, message) => {
      client.publish(channelId, message);
    },
  };
}
