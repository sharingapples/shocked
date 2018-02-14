/* global fetch, WebSocket */
import { NetInfo, AppState } from 'react-native';
import createSocket, { connectApi } from 'socket.red-client';

const EVENT = 'connectionChange';

const NativeValidator = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Unauthorized access/Invalid session');
    } else if (response.status === 200) {
      return response.json();
    } else {
      throw new Error(`Could not validate ${url}. Got ${response.status} - ${response.statusText}`);
    }
  } catch (err) {
    throw new Error(`Could not validate ${url}. Got ${err.message}`);
  }
};

export default function createNativeSocket(dispatch, options) {
  let handler = null;
  const Network = {
    isConnected: async () => NetInfo.isConnected.fetch(),

    onConnected: (listener) => {
      // Only one network listener should be used, so remove
      // any existing
      if (handler) {
        NetInfo.isConnected.removeEventListener(EVENT, handler);
      }

      // Create a new handler
      handler = (isConnected) => {
        if (isConnected) {
          NetInfo.isConnected.removeEventListener(EVENT, handler);
          listener();
        }
      };

      NetInfo.isConnected.addEventListener(EVENT, handler);
    },

    clear: () => {
      if (handler) {
        NetInfo.isConnected.removeEventListener(EVENT, handler);
      }
    },
  };

  const socket = createSocket(dispatch, options, WebSocket, Network, NativeValidator);

  AppState.addEventListener('change', (state) => {
    // As soon as the app goes to the background state, close the socket
    if (state === 'background') {
      socket.freeze();
    } else if (state === 'active') {
      socket.unfreeze();
    }
  });

  return socket;
}

export {
  connectApi,
};
