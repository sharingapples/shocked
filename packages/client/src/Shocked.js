/* global __DEV__, WebSocket */
// @flow
import React, {
  useRef, useState, useEffect, useContext, useMemo,
} from 'react';
import {
  API, API_RESPONSE, ACTION, IDENT, RECONN, IDENTIFIED, CONTEXT, SYNC,
} from 'shocked-common';

type Props = {
  url: string,  // Remote websocket url
  network: boolean, // Network online status
  ident: string, // Session id for identification
  clearIdent: () => {}, // Callback to clear identification. Alias to logout.

  // Callback called when custom error (4003) occurs
  onError: ({ code: number, reason: string }) => void,

  context: any, // Client context to be synced with server
  getContextParameters?: (any) => {},
  dispatch: (store: any, action: {}) => void,

  // List of apis that need to be supported
  api: { [string]: () => void | null },

  // A sync function to synchronize offline content
  sync: () => Promise<void>,

  // Reconnection attempt wait interval (milliseconds, default 1000)
  retryInterval?: number,
};

const SocketApiContext = React.createContext({});
const SocketStatusContext = React.createContext(false);

const notOnlineError = () => { throw new Error('No connection'); };

function fixUrl(url) {
  if (url.startsWith('http')) {
    return `ws${url.substr(4)}`;
  }
  return url;
}

export default function Shocked(props: Props) {
  const {
    url, network, ident, clearIdent, onError,
    retryInterval,
    api, sync, context, getContextParameters,
    dispatch,
    ...other
  } = props;
  const [online, setOnline] = useState(false);

  const instance = useRef({
    socket: null,
    api: null,
    apiId: 0,
    apiRequests: {},
    sessionId: null,
    serial: 0,
    context,
    getContextParameters,
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
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] Executing remote API ${name}`, payload);
      if (!send([API, id, name, payload])) {
        reject(new Error('Connection is not ready for API'));
        return;
      }

      instance.current.apiRequests[id] = [resolve, reject];
    });
  }

  // Update context
  instance.current.context = context;
  instance.current.getContextParameters = getContextParameters;
  instance.current.online = online;
  instance.current.apis = useMemo(() => {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log('[Shocked] Creating API structure');
    return Object.keys(api).reduce((res, name) => {
      const v = api[name];
      const apiFn = typeof v === 'function' ? v(res) : v;
      const offline = typeof apiFn === 'function' ? apiFn : notOnlineError;
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] API ${name}, offline=${typeof apiFn === 'function' ? 'YES' : 'NO'}`);
      res[name] = async (payload) => {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log(`[Shocked] Invoked API ${name}, Online=${instance.current.online}, Payload=`, payload);
        if (!instance.current.online) {
          try {
            const result = await offline(payload);
            return { error: false, result };
          } catch (err) {
            return { error: err.message, result: null };
          }
        }
        return queueApi(name, payload);
      };
      return res;
    }, {});
  }, [api]);

  const parsers = {
    // The server should treat the session dispatch
    // differently until the client is fully synced
    [ACTION]: (action, currentSerial) => {
      dispatch(action);
      if (currentSerial !== null) {
        if (online) instance.current.serial = currentSerial;
        // Let the server know that we have consumed the action
        send([SYNC, currentSerial]);
      }
    },
    [IDENTIFIED]: (sessionId) => {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] Session identified ${sessionId}`);
      instance.current.sessionId = sessionId;
      setOnline(true);

      // Start the synchronization process (pass apis object)
      sync(instance.current.apis);
    },
    [API_RESPONSE]: (id, error, result) => {
      const req = instance.current.apiRequests[id];
      if (req) {
        delete instance.current.apiRequests[id];
        const [resolve] = req;
        resolve({ error, result });
      } else if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[Shocked] Received an unknown API response (id=${id}, error=${error}, result=${result}`);
      }
    },
  };

  // Clear the session when ident changes
  useEffect(() => {
    instance.current.sessionId = null;
    instance.current.serial = 0;
  }, [ident]);

  // Setup connection manager
  useEffect(() => {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log(`[Shocked] Setup network=${network}, url=${url}, ident=${JSON.stringify(ident)}`);
    let cleaned = false;
    let ws = null; // Save current websocket connection for cleanup
    let attemptedAt = 0; // Keep track of connection attempt to calculate reconnection wait time
    let retryHandle = null; // Save timer handle for cleanup

    function connect() {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] Connection attempt cleaned=${cleaned}, url=${url}, network=${network}, ident=`, ident);

      // Avoid any form of side effects, that might arise due to any unexpected scenarios
      if (cleaned) return;
      attemptedAt = Date.now();
      const validUrl = fixUrl(url);


      ws = new WebSocket(validUrl);

      ws.onopen = async () => {
        instance.current.socket = ws;
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Shocked] Connection open. Preparing');
        // If we are trying to connect to an existing session
        if (instance.current.sessionId) {
          // eslint-disable-next-line no-console
          if (__DEV__) console.log(`[Shocked] Reconnect with session=${instance.current.sessionId}, serial=${instance.current.serial}`);

          // Try to resync with an existing session
          send([RECONN, instance.current.sessionId, instance.current.serial]);
        } else {
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Shocked] Identify ident', ident, 'context=', instance.current.context);

          // Send an identification frame
          send([
            IDENT, ident,
            instance.current.context,
            instance.current.getContextParameters(instance.current.context),
          ]);
        }
      };

      ws.onerror = (evt) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[Shocked] WebSocket.onError', evt);
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
          // eslint-disable-next-line no-console
          if (__DEV__) console.error(`[Shocked] error.onmessage ${err.message}`);
        }
      };

      ws.onclose = (evt) => {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log(`[Shocked] Connection closed. code=${evt.code}, reason=${evt.reason}`);

        // There is a likelyhood that a previous socket's close event
        // might arrive later than the open event of a new connection
        if (instance.current.socket === ws) {
          instance.current.socket = null;
        }

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
        if (evt.code === 4001 || evt.code === 4003) {
          // Clear the session information
          instance.current.sessionId = null;
          instance.current.serial = 0;
          // Make a reconnection attempt instantly
          attemptedAt = 0;
          if (evt.code === 4003) {
            // Looks like custom error send by server
            if (onError) onError(evt);
          }
        }

        // Unknown identification
        if (evt.code === 4002) {
          instance.current.sessionId = null;
          instance.current.serial = 0;
          if (clearIdent) clearIdent();
          return;
        }

        // Make a connection reattempt
        const interval = Math.max(1, retryInterval - (Date.now() - attemptedAt));
        // eslint-disable-next-line no-console
        if (__DEV__) console.log(`[Shocked] Connection retry in ${interval}(${retryInterval}). Last attempt was at ${attemptedAt}`);
        retryHandle = setTimeout(connect, interval);
      };
    }

    // Only connect when all the required values are a truthy
    if (network && ident && url) {
      connect();
    } else if (__DEV__) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] Avoiding connection network=${network}, ident=${ident}, url=${url}`);
    }

    return function cleanUp() {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Shocked] Connection cleanup cycle. ActiveConnection=${!!ws}`);
      cleaned = true;
      clearTimeout(retryHandle);
      if (ws) ws.close(4004, 'Shocked cleanup');
    };
  }, [network, ident, url]);

  // Handle the context change, if the context is changed.
  // * if live session, just send a context update message
  // * else, clear any existing session
  useEffect(() => {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log(`[Shocked] Context changed ${JSON.stringify(context)}`);
    // Update context whenever it changes
    if (isActive()) {
      send([CONTEXT, context, instance.current.getContextParameters(context)]);
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

Shocked.defaultProps = {
  retryInterval: 1000,
  getContextParameters: () => ({}),
};

export function useShockedStatus() {
  return useContext(SocketStatusContext);
}

export function useShockedApi() {
  return useContext(SocketApiContext);
}
