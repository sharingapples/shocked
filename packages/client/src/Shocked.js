/* global __DEV__, WebSocket */
// @flow
import React, {
  useMemo, useRef, useState, useEffect, useContext,
} from 'react';

type Props = {
  url: string,  // Remote websocket url
  sessionId: string, // Session id for identification
  network: boolean, // Network online status

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
    ...other
  } = props;
  const [online, setOnline] = useState(false);

  const socket = useRef(null);

  function isActive() {
    return socket.current && socket.current.readyState === WebSocket.OPEN;
  }

  function remoteApi(name, payload) {
    console.log('Execute api', name, payload);
  }

  // Bind all apis to its executable version
  const socketApis = useMemo(() => Object.keys(apis).reduce((res, name) => {
    const v = apis[name];
    const api = typeof v === 'function' ? v(/* app parameters ??? */) : v;
    const offline = typeof api === 'function' ? api : notOnlineError;
    res[name] = (payload) => {
      if (isActive()) {
        return remoteApi(name, payload);
      }
      return offline(payload);
    };
    return res;
  }, {}), [apis]);

  // Setup connection manager
  useEffect(() => {
    let cleaned = false;
    let ws = null; // Save current websocket connection for cleanup
    let attemptedAt = 0; // Keep track of connection attempt to calculate reconnection wait time
    let retryHandle = null; // Save timer handle for cleanup

    function connect() {
      // Avoid any form of side effects, that might arise due to any unexpected scenarios
      if (cleaned) return;
      attemptedAt = Date.now();
      const validUrl = fixUrl(url);
      ws = new WebSocket(validUrl);

      ws.onopen = () => {
        setOnline(true);
      };

      ws.onerror = (evt) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error(evt);
        }
      };

      ws.onclose = (evt) => {
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
    <SocketApiContext.Provider value={socketApis}>
      <SocketStatusContext.Provider {...other} value={online} />
    </SocketApiContext.Provider>
  );
}

export function useOnlineStatus() {
  return useContext(SocketStatusContext);
}
