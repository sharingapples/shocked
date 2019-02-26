const WebSocket = require('ws');
const {
  API, API_RESPONSE, EVENT, SYNC,
} = require('shocked-common');
const Serializer = require('./Serializer');

// Keep session expiry duration of 5 minutes
const SESSION_EXPIRY = 5 * 60 * 1000;

async function createSession(sessionId, params, apis, initSession) {
  let socket = null;
  let timerHandle = null;

  // Create serializer for the session
  const serializer = new Serializer();

  const send = (obj) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(obj));
    }
  };

  async function handleMessage(type, id, name, payload) {
    if (type === API) {
      // eslint-disable-next-line no-use-before-define
      const sessionApi = sessionApis[name];
      if (!sessionApi) {
        return send([API_RESPONSE, id, `Unknown api ${name}`]);
      }
      try {
        const res = await sessionApi(payload);
        return send([API_RESPONSE, id, null, res]);
      } catch (err) {
        return send([API_RESPONSE, id, err.message]);
      }
    }

    if (type === SYNC) {
      return serializer.sync(id);
    }

    return null;
  }

  const closeListeners = [];

  const session = Object.assign({}, params, {
    addCloseListener: (listener) => {
      closeListeners.push(listener);
      return closeListeners.length;
    },
    removeCloseListener: (listener) => {
      const idx = closeListeners.indexOf(listener);
      closeListeners.splice(idx, 1);
      return idx >= 0;
    },
    emit: (event, data) => {
      send([EVENT, event, data]);
    },
    dispatch: async (action) => {
      send([EVENT, 'action', action, serializer.push(action)]);
    },
    close: () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        socket = null;
      }

      closeListeners.forEach((listener) => {
        listener(sessionId);
      });
    },
    setContext: async (context) => {
      session.emit('context', context);
    },
    attach: async (ws, serial, context) => {
      clearTimeout(timerHandle);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = ws;
      socket.on('message', (msg) => {
        try {
          handleMessage(...JSON.parse(msg));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(err);
        }
      });
      socket.on('close', () => {
        // Setup a cleanup timer
        timerHandle = setTimeout(session.close, SESSION_EXPIRY);
      });

      const syncActions = serial
        ? serializer.getCachedActions(serial)
        // eslint-disable-next-line no-use-before-define
        : await populate(context);
      return send([EVENT, 'synced', syncActions, serializer.getSerial()]);
    },
  });

  const sessionApis = Object.keys(apis).reduce((res, name) => {
    res[name] = apis[name](session);
    return res;
  }, {});

  // Get the initial data populator method
  const populate = initSession(session);

  return session;
}

module.exports = createSession;
