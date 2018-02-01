/* global WebSocket */
import createSocket, { connectApi } from 'socket.red-client';
import { NetInfo, AppState } from 'react-native';

const EVENT = 'connectionChange';

export { connectApi };

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

  const socket = createSocket(dispatch, options, WebSocket, Network);

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
