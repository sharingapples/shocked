/* global __DEV__, WebSocket */
// @flow
import React, {
  useRef, useState, useEffect, useContext, useMemo,
} from 'react';
import {
  API, API_RESPONSE, ACTION, SYNC, SYNCED,
} from 'shocked-common';

type Props = {
  url: string,  // Remote websocket url
  sessionId: string, // Session id for identification
  network: boolean, // Network online status

  dispatch: (store: any, action: {}) => void,

  // A callback method to perform an automatic login when session is rejected
  login: () => void,

  // List of apis that need to be supported
  apis: { [string]: () => void | null },

  // A sync function that is executed continously as long as it returns truthy
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
    url, sessionId, network,
    login, retryInterval,
    apis, sync,
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
  });

  function isActive() {
    const { socket } = instance.current;
    return socket && socket.readyState === WebSocket.OPEN;
  }

  function send(data) {
    if (isActive()) {
      const { socket } = instance.current;
      socket.send(JSON.stringify(data));
      return true;
    }

    return false;
  }

  const parsers = {
    // The server should treat the session dispatch
    // differently until the client is fully synced
    [ACTION]: (action, currentSerial) => {
      if (online) instance.current.serial = currentSerial;
      dispatch(action);
    },
    [SYNCED]: (actions, currentSerial) => {
      instance.current.serial = currentSerial;
      dispatch(actions);
      setOnline(true);
    },
    [API_RESPONSE]: (id, error, response) => {
      const req = instance.current.apiQueue[id];
      if (req) {
        const [resolve, reject] = req;
        delete instance.current.apiQueue[id];
        if (error) {
          reject(new Error(response));
        } else {
          resolve(response);
        }
      }
    },
  };

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

  // Setup connection manager
  useEffect(() => {
    let cleaned = false;
    let ws = null; // Save current websocket connection for cleanup
    let attemptedAt = 0; // Keep track of connection attempt to calculate reconnection wait time
    let retryHandle = null; // Save timer handle for cleanup

    instance.current.serial = 0;

    function commit(context) {
      send([SYNC, {
        serial: instance.current.serial,
        context,
        timestamp: Date.now(),
      }]);
    }

    function connect() {
      // Avoid any form of side effects, that might arise due to any unexpected scenarios
      if (cleaned) return;
      attemptedAt = Date.now();
      const validUrl = fixUrl(url);
      ws = new WebSocket(validUrl);

      ws.onopen = async () => {
        const context = sync ? (await sync()) : null;
        commit(context);
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
        if (evt.close === 4001) {
          if (login) login();
          return;
        }

        // Make a connection reattempt
        const interval = Math.max(1, retryInterval - (Date.now() - attemptedAt));
        retryHandle = setTimeout(connect, interval);
      };
    }

    // Only connect when all the required values are a truthy
    if (url && sessionId && network) connect();

    return function cleanUp() {
      cleaned = true;
      clearTimeout(retryHandle);
      if (ws) ws.close();
    };
  }, [url, sessionId, network]);

  return (
    <SocketApiContext.Provider value={instance.current.apis}>
      <SocketStatusContext.Provider {...other} value={online} />
    </SocketApiContext.Provider>
  );
}

export function useOnlineStatus() {
  return useContext(SocketStatusContext);
}
