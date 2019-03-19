/* global __DEV__ */
import { createStore } from 'redux';
import { useState, useEffect } from 'react';
import createApplication from 'redux-hooked';

const URL = 'url';
const STATUS = 'status';
const SESSION = 'session';

const initialState = {
  session: {},
  url: null,
  status: 'offline',
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case URL:
      return {
        ...state,
        url: action.payload,
      };
    case STATUS:
      return {
        ...state,
        status: action.payload,
      };
    case SESSION:
      return {
        ...state,
        session: action.payload,
      };
    default:
      return state;
  }
};

// The shocked specific store for maintaining the internal state
// of the shocked sub system
const store = createStore(reducer);
const { useStore } = createApplication(store);

export function setSession(session) {
  if (__DEV__) {
    if (session === null || session === undefined || typeof session !== 'object') {
      // eslint-disable-next-line no-console
      console.error(`The session should be a valid object. You are trying to set it to ${session}`);
    }
  }
  const currentSession = store.getState().session;
  const update = typeof session === 'function' ? session(currentSession) : session;
  if (currentSession === update) return;
  store.dispatch({ type: SESSION, payload: update });
}

export function clearSession() {
  return setSession({});
}

export function getSession() {
  return store.getState().session;
}

export function isConnected() {
  return store.getState().status === 'online';
}

const urlListeners = [];
export function listenUrl(listener) {
  urlListeners.push(listener);
  return () => {
    const idx = urlListeners.indexOf(listener);
    if (idx >= 0) {
      urlListeners.splice(idx, 1);
    }
  };
}

const statusListeners = [];
export function listenStatus(listener, status) {
  const item = [listener, status];
  statusListeners.push(item);
  return () => {
    const idx = statusListeners.indexOf(item);
    if (idx >= 0) {
      statusListeners.splice(idx, 1);
    }
  };
}

export function setUrl(url) {
  if (store.getState().url === url) return;

  // Update url change listeners
  urlListeners.forEach(listener => listener(url));

  // Also update the store
  store.dispatch({ type: URL, payload: url });
}

export function getUrl() {
  return store.getState().url;
}

export function setStatus(status) {
  if (store.getState().status === status) return;

  // Update status change listeners
  statusListeners.forEach(([listener, rStatus]) => {
    if (!rStatus || rStatus === status) {
      listener(status);
    }
  });

  store.dispatch({ type: STATUS, payload: status });
}

export function useConnectionStatus(status) {
  return useStore(state => (status ? state.status === status : state.status), [status]);
}

export function useSession() {
  const session = useStore(state => state.session);
  return session;
}

export function useShocked(sessionManager) {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    let unsub = null;

    sessionManager.get().then((session) => {
      setSession(session);
      setSessionId(session.id);

      let prevSession = session;

      unsub = store.subscribe(() => {
        const currentSession = store.getState().session;
        if (prevSession === currentSession) {
          return;
        }

        prevSession = currentSession;
        sessionManager.set(currentSession);
        setSessionId(currentSession.id);
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return sessionId;
}
