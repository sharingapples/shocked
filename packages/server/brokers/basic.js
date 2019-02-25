module.exports = function singleServerBroker(name) {
  const createKey = id => `${name}:${id}`;
  const channels = {};

  return {
    subscribe: (id, session) => {
      const key = createKey(id);
      const sessions = channels[key] || [];
      if (sessions.length === 0) {
        channels[key] = sessions;
      }
      sessions.push(key);

      return {
        release: () => {
          const idx = sessions.indexOf(session);
          if (idx >= 0) {
            sessions.splice(idx, 1);
          }
          if (sessions.length === 0) {
            delete channels[key];
          }
        },
      };
    },
    publish: (id, msg) => {
      const key = createKey(id);
      const sessions = channels[key];
      if (sessions && sessions.length > 0) {
        sessions.forEach(session => session.dispatch(...msg));
      }
    },
  };
};
