/**
 * A default channel provider that works on a single system.
 * For production use consider something like redsock-channel-redis
 */

export default function createDefaultProvider() {
  const channels = {};

  return {
    // TODO: Make sure the session is not added more than once
    subscribe: (channelId, session) => {
      const list = channels[channelId];
      if (!list) {
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
      }
      return true;
    },

    publish: (channelId, message) => {
      const list = channels[channelId];
      if (list) {
        list.forEach(session => session.send(message));
      }
    },
  };
}
