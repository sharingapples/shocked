/* global WebSocket */
const createEventManager = require('./EventManager');
const createRPC = require('./RPC');
const createErrorManager = require('./ErrorManager');

const EVENT_CONNECT = 'connect';
const EVENT_DISCONNECT = 'disconnect';
const EVENT_ERROR = 'error';
const EVENT_MESSAGE = 'message';
const EVENT_EVENT = 'event';

const DefaultNetwork = {
  isConnected: () => true,
  onConnected: () => { throw new Error('Should not be called'); },
  clear: () => {},
};

module.exports = function createSocket(
  dispatch,
  options = {},
  WebSocketImpl = WebSocket,
  Network = DefaultNetwork
) {
  const { errorRetryInterval = 3000, responseTimeoutInterval = 3000 } = options;

  const eventManager = createEventManager([
    EVENT_CONNECT, EVENT_DISCONNECT, EVENT_MESSAGE, EVENT_ERROR, EVENT_EVENT,
  ]);

  const fnConnect = () => connect(); // eslint-disable-line no-use-before-define

  const rpc = createRPC(responseTimeoutInterval, fnConnect);
  const errorManager = createErrorManager(
    eventManager.emit.bind(null, EVENT_ERROR),
    fnConnect,
    errorRetryInterval
  );

  let socket = null;
  let currentUrl = null;
  let connected = false;

  async function connect() {
    // if there is an existing connection, close it
    // It will trigger an auto connect
    if (socket !== null) {
      socket.close();
      socket = null;
      return;
    }

    // Only connect if we have a url to connect to
    if (currentUrl === null) {
      return;
    }

    // Only proceed if there is a connection
    if (!await Network.isConnected()) {
      // Add a handler to reconnect as soon as the network is available
      Network.onConnected(connect);
      return;
    }

    // Finally try to connect
    socket = new WebSocketImpl(currentUrl);
    socket.onopen = () => {
      connected = true;
      eventManager.emit(EVENT_CONNECT);
    };

    socket.onclose = () => {
      // As soon as a socket is closed, reject any pending rpcs
      rpc.reject(null, { message: 'Connection is closed' });
      socket = null;
      if (connected) {
        connected = false;
        eventManager.emit(EVENT_DISCONNECT);
      }

      // As soon as a socket closes, try to connect again
      // if there wasn't any error
      if (errorManager.get() === null) {
        connect();
      }
    };

    socket.onerror = (e) => {
      const res = /.*bad response code .*([0-9]{3}).*/.exec(e.message);
      if (res) {
        errorManager.set(parseInt(res[1], 10), e.message);
      } else {
        errorManager.set(-1, `Socket Error - ${e.message}`);
      }
      rpc.reject(null, errorManager.get());
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (Array.isArray(msg)) {
          const code = msg[0];
          if (code > 0) {
            const error = msg[1];
            const result = msg[2];
            if (error) {
              rpc.reject(code, result);
            } else {
              rpc.resolve(code, result);
            }
          } else if (code === 0) {
            // Got a action to dispatch
            dispatch(msg[1]);
          } else if (code === -1) {
            // Got a event to trigger
            eventManager.emit(EVENT_EVENT, msg[1], msg[2]);
          }
        }
      } catch (err) {
        // Ignore any error
      }
    };
  }

  return {
    open: (url) => {
      currentUrl = url;
      connect();
    },

    freeze: () => {
      errorManager.set(0, 'Freezing', 0);
      if (socket !== null) {
        socket.close();
        socket = null;
      }
    },

    unfreeze: () => {
      errorManager.clear();
      connect();
    },

    close: () => {
      currentUrl = null;

      // Clear any listeners from Network
      Network.clear();
      errorManager.clear();
      rpc.clear();

      if (socket !== null) {
        socket.close();
        socket = null;
      }
    },

    on: eventManager.add,

    rpc: async (cmd, args) => {
      if (socket === null) {
        throw new Error('Not connected');
      }

      const { id, promise } = rpc.create();
      socket.send(JSON.stringify([id, cmd, args]));
      return promise;
    },
  };
};
