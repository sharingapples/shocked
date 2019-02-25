// eslint-disable-next-line import/no-unresolved
import { NetInfo } from 'react-native';

export default {
  listen: (listener) => {
    // Get the initial connection status
    let online = false;

    function handler(connectionInfo) {
      const status = connectionInfo.type !== 'none';
      if (status !== online) {
        online = status;
        listener(online);
      }
    }

    NetInfo.getConnectionInfo().then((connectionInfo) => {
      online = connectionInfo !== 'none';
      listener(online);
    });

    NetInfo.addEventListener('connectionChange', handler);

    return () => {
      NetInfo.removeEventListener('connectionChange', handler);
    };
  },
};
