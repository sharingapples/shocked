// A PoC local broker that works only on a single server system
// Use somthing like redis for a more distributed pub/sub brokering
module.exports = function createChannel(name) {
  const key = id => `${name}:${id}`;

  const channels = {};

  return {
    subscribe: (id, session) => {
      const channelId = key(id);
      const sessions = channels[channelId] || [];
      sessions.push(session);
      if (sessions.length === 1) {
        channels[channelId] = sessions;
      }

      // Add a close listener to remove the sessions
      session.addCloseListener(() => {
        const idx = sessions.indexOf(session);
        if (idx >= 0) {
          sessions.splice(idx, 1);
        }
      });
    },
    publish: (id, action) => {
      const channelId = key(id);
      const sessions = channels[channelId];
      if (sessions && sessions.length) {
        sessions.forEach((session) => {
          session.dispatch(action);
        });
      }
    },
  };
};
