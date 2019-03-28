/* global __DEV__, WebSocket */
// @flow
import React, {
  useRef, useState, useEffect, useContext, useMemo,
} from 'react';
import {
  API, API_RESPONSE, ACTION, IDENT, RECONN, IDENTIFIED, CONTEXT,
} from 'shocked-common';

type Props = {
  url: string,  // Remote websocket url
  network: boolean, // Network online status
  ident: string, // Session id for identification
  clearIdent: () => {}, // Callback to clear identification. Alias to logout.

  context: any, // Client context to be synced with server
  dispatch: (store: any, action: {}) => void,

  // List of apis that need to be supported
  apis: { [string]: () => void | null },

  // A sync function to synchronize offline content
  sync: () => Promise<void>,

  // Reconnection attempt wait interval (milliseconds, default 1000)
  retryInterval: number,
};

const SocketApiContext = React.createContext({});
const SocketStatusContext = React.createContext(false);

const notOnlineError = () => throw new Error('No connection');

function fixUrl(url) {
  if (url.startsWith('http')) {
    return `ws${url.substr(4)}`;
  }
  return url;
}

export default function Shocked(props: Props) {
  const {
    url, network, ident, clearIdent,
    retryInterval,
    apis, sync, context,
    dispatch,
    ...other
  } = props;
  const [online, setOnline] = useState(false);

  const instance = useRef({
    socket: null,
    apis: null,
    apiId: 0,
    apiRequests: {},
    serial: 0,
    context,
  });

  // Helper function to check if an active socket is available
  function isActive() {
    const { socket } = instance.current;
    return socket && socket.readyState === WebSocket.OPEN;
  }

  // Helper method to send data over the active socket
  function send(data) {
    if (isActive()) {
      const { socket } = instance.current;
      socket.send(JSON.stringify(data));
      return true;
    }

    return false;
  }

  // Helper function to keep api calls in a queue
  function queueApi(name, payload) {
    instance.current.apiId += 1;
    const id = instance.current.apiId;
    return new Promise((resolve, reject) => {
      if (!send([API, id, name, payload])) {
        reject(new Error('Connection is not ready for API'));
        return;
      }

      instance.current.apiRequests[id] = [resolve, reject];
    });
  }

  // Update context
  instance.current.context = context;
  instance.current.apis = useMemo(() => (
    Object.keys(apis).reduce((res, name) => {
      const v = apis[name];
      const api = typeof v === 'function' ? v(res) : v;
      const offline = typeof api === 'function' ? api : notOnlineError;
      res[name] = async (payload) => {
        if (!online) {
          return offline(payload);
        }
        return queueApi(name, payload);
      };
      return res;
    })
  ), [apis]);

  const parsers = {
    // The server should treat the session dispatch
    // differently until the client is fully synced
    [ACTION]: (action, currentSerial) => {
      if (online) instance.current.serial = currentSerial;
      dispatch(action);
    },
    [IDENTIFIED]: (sessionId) => {
      instance.current.sessionId = sessionId;
      setOnline(true);
    },
    [API_RESPONSE]: (id, error, result) => {
      const req = instance.current.apiQueue[id];
      if (req) {
        delete instance.current.apiQueue[id];
        const [resolve] = req;
        resolve({ error, result });
      } else if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error(`Received an unknown API response (id=${id}, error=${error}, result=${result}`);
      }
    },
  };

  // Setup connection manager
  useEffect(() => {
    let cleaned = false;
    let ws = null; // Save current websocket connection for cleanup
    let attemptedAt = 0; // Keep track of connection attempt to calculate reconnection wait time
    let retryHandle = null; // Save timer handle for cleanup

    instance.current.serial = 0;

    function connect() {
      // Avoid any form of side effects, that might arise due to any unexpected scenarios
      if (cleaned) return;
      attemptedAt = Date.now();
      const validUrl = fixUrl(url);
      ws = new WebSocket(validUrl);

      ws.onopen = async () => {
        instance.current.socket = ws;
        // If we are trying to connect to an existing session
        if (instance.current.sessionId) {
          // Try to resync with an existing session
          send([RECONN, instance.current.sessionId, instance.current.serial]);
        } else {
          // Send an identification frame
          send([IDENT, ident, context]);
        }
      };

      ws.onerror = (evt) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error(evt);
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (!Array.isArray(msg)) throw new Error('Message is not an array');
          const parser = parsers[msg[0]];
          if (!parser) throw new Error(`No parser found for message type ${msg[0]}`);
          parser(...msg.slice(1));
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.error(`${err.message}::${evt.data}`);
          }
        }
      };

      ws.onclose = (evt) => {
        instance.current.socket = null;

        // Make sure the connection is offline
        setOnline(false);

        // Reject any pending promises
        Object.keys(instance.current.apiRequests).forEach((id) => {
          const [, reject] = instance.current.apiRequests[id];
          reject('Lost connection during api request');
          delete instance.current.apiRequests[id];
        });

        // If already cleaned no need to do anything
        if (cleaned) return;

        // Looks like we got an invalid session, try to change the session
        if (evt.code === 4001) {
          // Clear the session information
          instance.current.sessionId = null;
          instance.current.serial = 0;
        }

        // Unknown identification
        if (evt.code === 4002) {
          instance.current.sessionId = null;
          instance.current.serial = 0;
          clearIdent();
          return;
        }

        // Make a connection reattempt
        const interval = Math.max(1, retryInterval - (Date.now() - attemptedAt));
        retryHandle = setTimeout(connect, interval);
      };
    }

    // Only connect when all the required values are a truthy
    if (network && ident && url) connect();

    return function cleanUp() {
      cleaned = true;
      clearTimeout(retryHandle);
      if (ws) ws.close();
    };
  }, [network, ident, url]);

  // Handle the context change, if the context is changed.
  // * if live session, just send a context update message
  // * else, clear any existing session
  useEffect(() => {
    // Update context whenever it changes
    if (isActive()) {
      send([CONTEXT, context]);
    } else {
      // clear the session if the context changes
      instance.current.sessionId = null;
      instance.current.serial = 0;
      // Just to avoid the transient conditions, close the socket
      if (instance.current.socket) instance.current.socket.close();
    }
  }, [context]);

  return (
    <SocketApiContext.Provider value={instance.current.apis}>
      <SocketStatusContext.Provider {...other} value={online} />
    </SocketApiContext.Provider>
  );
}

export function useShockedStatus() {
  return useContext(SocketStatusContext);
}

export function useShockedApi() {
  return useContext(SocketApiContext);
}
