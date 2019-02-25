/* global window, navigator */
export default {
  listen: (listener) => {
    let online = navigator.onLine;

    function handleOnline() {
      if (!online) {
        online = true;
        listener(online);
      }
    }

    function handleOffline() {
      if (online) {
        online = false;
        listener(online);
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
};
