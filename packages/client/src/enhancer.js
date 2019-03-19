import { SYNC, API_TYPE } from 'shocked-common';
import {
  setStatus, setSession, getSession, listenUrl,
} from './Shocked';
import createClient from './createClient';

const BATCHED = 'shocked.batched';

const enableBatching = reducer => (
  function batchingReducer(state, action) {
    if (action.type === BATCHED) {
      return action.payload.reduce(batchingReducer, state);
    }

    return reducer(state, action);
  }
);

export default function shockedEnhancer(options = {}) {
  const client = createClient(null, null, options);
  let serial = null;

  listenUrl((url) => {
    const session = getSession();
    client.setEndpoint(url, session.id);
  });

  return createStore => (reducer, preloadedState, enhancer) => {
    const store = createStore(enableBatching(reducer), preloadedState, enhancer);
    const { dispatch } = store;

    client.on('connecting', () => {
      setStatus('connecting');
    });

    client.on('open', () => {
      const session = getSession();
      // Send a sync event as soon as the client connection is open
      client.send([serial, session.context]);
    });

    client.on('SYNC', (obj) => {
      setSession(session => ({
        ...session,
        ...obj,
      }));
    });

    client.on('synced', (actions, syncSerial, session) => {
      serial = syncSerial;
      setSession(session);
      dispatch({ type: BATCHED, payload: actions });
      setStatus('online');
    });

    client.on('close', () => {
      setStatus('offline');
    });

    client.on('rejected', () => {
      setStatus('rejected');
    });

    client.on('context', (serverContext) => {
      setSession(session => ({
        ...session,
        context: typeof session.context === 'object' ? {
          ...session.context,
          ...serverContext,
        } : serverContext,
      }));
    });

    client.on('action', (action, serverSerial) => {
      if (serverSerial) {
        serial = serverSerial;
        client.send([SYNC, serial]);
      }

      if (Array.isArray(action)) {
        dispatch({ type: BATCHED, payload: action });
      } else {
        dispatch(action);
      }
    });

    return {
      ...store,
      dispatch: (action) => {
        if (action.type === API_TYPE) {
          return client.execute(action.name, action.payload);
        }

        return dispatch(action);
      },
    };
  };
}
