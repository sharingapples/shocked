/**
 * A default channel provider that works on a single system.
 * For production use consider something like redsock-channel-redis
 */

export default function createDefaultProvider() {
  const channels = {};

  return {
    subscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
        channels[channelId] = [session];
      } else {
        list.push(session);
      }

      // Return an unsubscribe method
      return () => {
        const idx = list.indexOf(session);
        if (idx >= 0) {
          list.splice(idx, 1);
          if (list.length === 0) {
            delete channels[channelId];
          }
        }
      };
    },
    publish: (channelId, message) => {
      const list = channels[channelId];
      if (list) {
        list.forEach(session => session.send(message));
      }
    },
  };
}
