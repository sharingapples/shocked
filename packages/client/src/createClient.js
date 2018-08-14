import { createParser } from 'shocked-common';
import TrackerClient from './TrackerClient';

const EventEmitter = require('events');

function createClient(host, WebSocket = global.WebSocket) {
  if (!host.startsWith('ws://') && !host.startsWith('wss://')) {
    throw new Error(`Invalid host ${host}. Host should start with ws:// or wss://`);
  }

  const trackers = [];
  const parser = createParser();

  const eventManager = new EventEmitter();

  function connection(remoteUrl) {
    if (remoteUrl === null) {
      return null;
    }

    const sock = new WebSocket(remoteUrl);

    sock.onopen = () => {
      // Let all the trackers know tha we are now connected
      trackers.forEach((tracker) => {
        // eslint-disable-next-line no-use-before-define
        tracker.onConnect(client);
      });

      // Trigger the connect event
      eventManager.emit('connect');
    };

    sock.onclose = () => {
      trackers.forEach((tracker) => {
        // Let all the trackers know that the client is not available
        tracker.onDisconnect();
      });

      // Fire the close event on client
      eventManager.emit('disconnect');
    };


    sock.onmessage = (e) => {
      parser.parse(e.data);
    };

    return sock;
  }

  parser.onTrackerResponseNew = (trackerId, serial, data, apis) => {
    const tracker = trackers[trackerId];
    if (tracker) {
      tracker.onCreate(serial, data, apis);
    }
  };

  parser.onTrackerResponseUpdate = (trackerId, serial, actions) => {
    const tracker = trackers[trackerId];
    if (tracker) {
      tracker.onUpdate(serial, actions);
    }
  };

  parser.onTrackerAction = (trackerId, action) => {
    const tracker = trackers[trackerId];
    if (tracker) {
      tracker.onAction(action);
    }
  };

  parser.onTrackerApiResponse = (trackerId, apiId, status, response, params) => {
    const tracker = trackers[trackerId];
    if (tracker) {
      tracker.onApiResponse(apiId, status, response, params);
    }
  };

  parser.onTrackerEvent = (trackerId, event, data) => {
    const tracker = trackers[trackerId];
    if (tracker) {
      tracker.emit(event, data);
    }
  };

  // Initialize with a connection attempt
  let socket = null;

  const client = {
    on: (event, listener) => {
      if (listener) {
        eventManager.on(event, listener);
      }
    },

    off: (event, listener) => {
      if (listener) {
        eventManager.off(event, listener);
      }
    },

    isConnected: () => socket && socket.readyState === WebSocket.OPEN,

    connect: (path) => {
      const url = `${host}${path}`;
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
      // Cannot connect without a remote url
      if (socket === null) {
        return false;
      }

      // Use the given url or a last successfully connected url
      const finalUrl = socket.url;

      // Since its a reconnect attempt, we will close existing socket
      if (socket !== null) {
        socket.close();
      }

      socket = connection(finalUrl);
      return true;
    },

    close: () => {
      if (socket) {
        socket.close();
      }
      socket = null;
    },

    send: (data) => {
      if (!client.isConnected()) {
        return;
      }

      socket.send(data);
    },

    createTracker: (trackerId, channel, store, params = {}) => {
      // make sure this trackerId is unique for this client
      if (trackers.find(tracker => tracker.trackerId === trackerId)) {
        throw new Error(`A tracker for ${trackerId} already exists on the client. There can only be one tracker for one trackerId.`);
      }

      const tracker = new TrackerClient(store, trackerId, channel, params, () => {
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
