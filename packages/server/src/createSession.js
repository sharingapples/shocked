const WebSocket = require('ws');
const {
  API, API_RESPONSE, EVENT, SYNC,
} = require('shocked-common');
const Serializer = require('./Serializer');

// Keep session expiry duration of 5 minutes
const SESSION_EXPIRY = 5 * 60 * 1000;

async function createSession(sessionId, params, apis, context, initSession, closeSession) {
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

  let subscription = null;

  const session = Object.assign({}, params, {
    subscribe: (channel, id) => {
      if (subscription) {
        throw new Error('Cannot subscribe to more than one channel');
      }
      subscription = channel.subscribe(id, session);
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

      if (subscription) {
        subscription.release();
        closeSession(sessionId);
        subscription = null;
      }
    },
    attach: async (ws, serial) => {
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
