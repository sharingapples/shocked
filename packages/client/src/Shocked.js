/* global __DEV__ */
import { createStore } from 'redux';
import { useState, useEffect } from 'react';
import { useStore } from 'redux-hooked';

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
  store.dispatch({ type: STATUS, payload: status });
}

export function useConnectionStatus() {
  return useStore(state => state.status);
}

export function useSession() {
  const session = useStore(state => state.session);
  return [session, setSession];
}

export function useShocked(sessionManager) {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    let unsub = null;

    sessionManager.get().then((session) => {
      setSession(session);
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
