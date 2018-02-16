/* global WebSocket */
const createEventManager = require('./EventManager');
const createRPC = require('./RPC');
const createErrorManager = require('./ErrorManager');
const ValidationError = require('./ValidationError');

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

const DefaultValidator = url => url;

module.exports = function createSocket(
  dispatch,
  options = {},
  WebSocketImpl = WebSocket,
  Network = DefaultNetwork,
  // A validator function, to check if the given url is valid. It could be used to
  // validate a session. Since the HTTP status codes are not propogated back to
  // the clients properly, an ajax call should be made to validate the url
  validator = DefaultValidator
) {
  const {
    errorRetryInterval = 3000,
    responseTimeoutInterval = 3000,
    disconnectConnectDebounce = 0,
  } = options;

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
  let connecting = false; // Avoid multiple connection attempts
  async function connect() {
    if (connecting) {
      return;
    }
    connecting = true;

    // if there is an existing connection, close it
    // It will trigger an auto connect
    if (socket !== null) {
      socket.close();
      socket = null;
      connecting = false;
      return;
    }

    // Only connect if we have a url to connect to
    if (currentUrl === null) {
      connecting = false;
      return;
    }

    // Only proceed if there is a connection
    if (!await Network.isConnected()) {
      // Add a handler to reconnect as soon as the network is available
      Network.onConnected(connect);
      connecting = false;
      return;
    }

    // Make sure the currentUrl is valid before opening the socket
    let validationResult = null;
    try {
      validationResult = await validator(currentUrl);
    } catch (err) {
      if (err instanceof ValidationError) {
        errorManager.setValidationError(err);
      } else {
        errorManager.setConnectError(err);
      }
      connecting = false;
      return;
    }

    // Finally try to connect
    socket = new WebSocketImpl(currentUrl);
    socket.onopen = () => {
      connected = true;
      eventManager.delayEmit(0, EVENT_CONNECT, validationResult);
    };

    socket.onclose = (e) => {
      // As soon as a socket is closed, reject any pending rpcs
      rpc.reject(null, { message: 'Connection is closed' });
      socket = null;
      if (connected) {
        connected = false;

        // Do not include a debounce if its the final close
        const delay = currentUrl === null ? 0 : disconnectConnectDebounce;
        eventManager.delayEmit(delay, EVENT_DISCONNECT, e);
      }

      // As soon as a socket closes, try to connect again
      // if there wasn't any error
      if (errorManager.get() === null) {
        connect();
      }
    };

    socket.onerror = (e) => {
      if (connected) {
        errorManager.setGenericError(e);
      } else {
        errorManager.setConnectError(e);
      }
      rpc.reject(null, errorManager.get());
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (Array.isArray(msg)) {
          const code = msg[0];
          if (code > 0) {
            const success = msg[1];
            const result = msg[2];
            if (success === true) {
              rpc.resolve(code, result);
            } else if (success === false) {
              rpc.reject(code, new Error(result));
            } else {
              rpc.reject(code, new Error(`Invalid response ${success}`));
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
        // eslint-disable-next-line no-console
        console.error(err);
        // Ignore any error
      }
    };

    connecting = false;
  }

  return {
    open: (url) => {
      currentUrl = url;
      connect();
    },

    freeze: () => {
      // Set an error, so that the reconnection doesn't happen automatically
      // Also make sure there is not timer set for the error retry
      errorManager.setFrozenError();
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
