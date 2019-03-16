import { SYNC, API_TYPE } from 'shocked-common';

import createClient from './createClient';

const CONNECTIVITY = 'shocked.connectivity';
const UPDATE_REMOTE_URL = 'shocked.url';
const BATCHED = 'shocked.batched';

const connectivity = status => ({
  type: CONNECTIVITY,
  payload: status,
});

export function shockedReducer(state = {}, action) {
  switch (action.type) {
    case CONNECTIVITY:
      return {
        ...state,
        connectivity: action.payload,
      };
    default:
      return state;
  }
}

export function getConnectivity(state) {
  return state.connectivity;
}

export function setUrl(endpoint, sessionId) {
  return {
    type: UPDATE_REMOTE_URL,
    payload: { endpoint, sessionId },
  };
}

const enableBatching = reducer => (
  function batchingReducer(state, action) {
    if (action.type === BATCHED) {
      return action.payload.reduce(batchingReducer, state);
    }

    return reducer(state, action);
  }
);

export default function shockedEnhancer(url = null, sessId = null, options = {}) {
  const client = createClient(url, sessId, options);
  let serial = null;
  let context = options.initialContext || null;

  return createStore => (reducer, preloadedState, enhancer) => {
    const store = createStore(enableBatching(reducer), preloadedState, enhancer);
    const { dispatch } = store;

    client.on('connecting', () => {
      dispatch(connectivity('connecting'));
    });

    client.on('open', () => {
      // Send a sync event as soon as the client connection is open
      client.send([serial, context]);
    });

    client.on('synced', (actions, syncSerial) => {
      serial = syncSerial;
      dispatch({ type: BATCHED, payload: actions.concat(connectivity('online')) });
    });

    client.on('close', () => {
      dispatch(connectivity('offline'));
    });

    client.on('rejected', () => {
      dispatch(connectivity('rejected'));
    });

    client.on('context', (serverContext) => {
      if (typeof context === 'object') {
        Object.assign(context, serverContext);
      } else {
        context = serverContext;
      }
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
        if (action.type === UPDATE_REMOTE_URL) {
          const { endpoint, sessionId } = action.payload;
          return client.setEndpoint(endpoint, sessionId);
        }

        if (action.type === API_TYPE) {
          return client.execute(action.name, action.payload);
        }

        return dispatch(action);
      },
    };
  };
}
