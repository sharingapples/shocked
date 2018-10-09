import { createParser } from 'shocked-common';
import TrackerClient from './TrackerClient';

// Try reconnection in few second(s)
const RECONNECT_INTERVAL = 2500;

const EventEmitter = require('events');

function getHost(endpoint) {
  // convert http to ws
  if (endpoint.startsWith('https:') || endpoint.startsWith('http:')) {
    return 'ws'.concat(endpoint.substr(4));
  }

  // use ws as is
  if (endpoint.startsWith('wss:') || endpoint.startsWith('ws:')) {
    return endpoint;
  }

  // fallback if the endpoint is not recognizable
  throw new Error(`Invalid endpoint ${endpoint}. It should start with one of http:, https:, ws: or wss:`);
}

function createClient(endpoint, WebSocket = global.WebSocket) {
  const host = getHost(endpoint);

  // Using an array, since the number of trackers is not expected
  // to be very high, typically 2 trackers at a time
  const trackers = [];
  function findTracker(trackerId) {
    return trackers.find(tracker => tracker.group === trackerId);
  }

  const parser = createParser();

  const eventManager = new EventEmitter();

  let reconnectTimerHandle = null;
  function setupReconnection(interval) {
    if (reconnectTimerHandle) {
      return;
    }

    reconnectTimerHandle = setTimeout(() => {
      reconnectTimerHandle = null;
      // eslint-disable-next-line no-use-before-define
      client.reconnect();
    }, interval);
  }

  function clearRetry() {
    if (reconnectTimerHandle) {
      clearTimeout(reconnectTimerHandle);
      reconnectTimerHandle = null;
    }
  }

  function connection(remoteUrl) {
    if (remoteUrl === null) {
      return null;
    }

    const sock = new WebSocket(remoteUrl);
    sock.onerror = (e) => {
      // the onclose event would be hit after the onerror, so just warn about the error for
      // development mode
      // eslint-disable-next-line no-console
      console.warn(e.message);
    };

    sock.onopen = () => {
      // Clear any auto reconnect attempts
      clearRetry();

      // Let all the trackers know tha we are now connected
      trackers.forEach((tracker) => {
        // eslint-disable-next-line no-use-before-define
        tracker.onConnect(client);
      });

      // Trigger the connect event
      eventManager.emit('connect');
    };

    sock.onclose = (e) => {
      // do not try to reconnect for specific errors
      // 1000: regular socket shutdown
      // 1001: TODO: This seems to be the code when the client initiates close.
      //             Should the retry be avoided in this case as well
      // 1005: Expected close status, recevied none - ???
      // 4001: Session expired - via shocked
      if (e.code !== 1000 && /* e.code !== 1001 && */ e.code !== 1005 && e.code !== 4001) {
        // Try to reconnect again after sometime
        setupReconnection(RECONNECT_INTERVAL);
      }

      trackers.forEach((tracker) => {
        // Let all the trackers know that the client is not available
        tracker.onDisconnect();
      });

      // Fire the close event on client
      eventManager.emit('disconnect', e.code);
    };


    sock.onmessage = (e) => {
      parser.parse(e.data);
    };

    return sock;
  }

  parser.onTrackerCreateNew = (trackerId, serial, data, apis) => {
    const tracker = findTracker(trackerId);
    if (tracker) {
      tracker.onCreate(serial, data, apis);
    }
  };

  parser.onTrackerCreateUpdate = (trackerId, serial, actions) => {
    const tracker = findTracker(trackerId);
    if (tracker) {
      tracker.onUpdate(serial, actions);
    }
  };

  parser.onTrackerAction = (trackerId, action) => {
    const tracker = findTracker(trackerId);
    if (tracker) {
      tracker.onAction(action);
    }
  };

  parser.onTrackerApiResponse = (trackerId, apiId, status, response, params) => {
    const tracker = findTracker(trackerId);
    if (tracker) {
      tracker.onApiResponse(apiId, status, response, params);
    }
  };

  parser.onTrackerEmit = (trackerId, event, data) => {
    const tracker = findTracker(trackerId);
    if (tracker) {
      tracker.emit(event, data);
    }
  };

  // Initialize with a connection attempt
  let socket = null;
  let url = null;

  const client = {
    on: (event, listener) => {
      if (listener) {
        eventManager.on(event, listener);
      }
    },

    off: (event, listener) => {
      if (listener) {
        eventManager.removeListener(event, listener);
      }
    },

    isConnected: () => socket && socket.readyState === WebSocket.OPEN,

    connect: (path) => {
      url = `${host}/${path}`;
      if (client.isConnected() && socket.url === url) {
        return true;
      }

      if (socket !== null) {
        socket.close();
      }

      socket = connection(url);
      return true;
    },

    reconnect: () => {
      // Only make a reconnect event if the socket is already connected
      if (url === null || (socket && socket.readyState === WebSocket.CONNECTING)) {
        // No prior url to reconnect to
        return false;
      }

      // Since its a reconnect attempt, we will close existing socket
      if (socket !== null) {
        socket.close();
      }

      socket = connection(url);
      return true;
    },

    close: () => {
      if (socket) {
        socket.close();
      }
      socket = null;

      clearRetry();
    },

    send: (data) => {
      if (!client.isConnected()) {
        return;
      }

      socket.send(data);
    },

    createTracker: (trackerId, store, params = {}) => {
      // make sure this trackerId is unique for this client
      if (trackers.find(tracker => tracker.trackerId === trackerId)) {
        throw new Error(`A tracker for ${trackerId} already exists on the client. There can only be one tracker for one trackerId.`);
      }

      const tracker = new TrackerClient(store, trackerId, params, () => {
        const idx = trackers.indexOf(tracker);
        if (idx >= 0) {
          trackers.splice(idx, 1);
        }
      });

      // Include the tracker in the list
      trackers.push(tracker);

      // Send a connect event if the client is already connect
      if (client.isConnected()) {
        tracker.onConnect(client);
      }

      return tracker;
    },
  };

  return client;
}

export default createClient;
