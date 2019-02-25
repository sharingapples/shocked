import createClient from './createClient';

const CONNECTIVITY = 'shocked.connectivity';
const UPDATE_REMOTE_URL = 'shocked.url';
const API = 'shocked.api';
const BATCHED = 'shocked.batched';

const connectivity = status => ({
  type: CONNECTIVITY,
  payload: status,
});

export function getConnectivity(state) {
  return state.connectivity;
}

export function setUrl(url) {
  return {
    type: UPDATE_REMOTE_URL,
    payload: url,
  };
}

const enableShocking = reducer => (
  function shockingReducer(state, action) {
    if (action.type === CONNECTIVITY) {
      return {
        connectivity: action.payload,
        ...state,
      };
    }

    if (action.type === BATCHED) {
      return action.payload.reduce(shockingReducer);
    }

    return reducer(state, action);
  }
);

export default function shockedEnhancer(url = null, options = {}) {
  const client = createClient(url, options);
  let serial = null;
  let context = null;

  return createStore => (reducer, preloadedState, enhancer) => {
    const store = createStore(enableShocking(reducer), preloadedState, enhancer);
    const { dispatch, getState } = store;

    client.on('connecting', () => {
      dispatch(connectivity('connecting'));
    });

    client.on('open', () => {
      // Send a sync event as soon as the client connection is open
      client.send(JSON.stringify([serial, context]));
    });

    client.on('synced', () => {
      dispatch(connectivity('online'));
    });

    client.on('close', () => {
      dispatch(connectivity('offline'));
    });

    client.on('rejected', () => {
      dispatch(connectivity('rejected'));
    });

    client.on('context', (serverContext) => {
      context = serverContext;
    });

    client.on('action', (action, serverSerial) => {
      if (serverSerial) {
        serial = serverSerial;
      }

      if (Array.isArray(action)) {
        dispatch({ type: BATCHED, payload: action });
      } else {
        dispatch(action);
      }
    });

    return {
      dispatch: (action) => {
        if (action.type === UPDATE_REMOTE_URL) {
          if (!action.payload) {
            return client.close();
          }
          return client.open(action.payload);
        }

        if (action.type === API) {
          return client.execute(action.name, action.payload);
        }

        return dispatch(action);
      },
      getState,
    };
  };
}
