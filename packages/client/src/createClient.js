import {
  createParser,
  PKT_RPC_REQUEST,
  PKT_SCOPE_REQUEST,
  PKT_CALL,
  PKT_TRACKER_RPC_REQUEST,
  RPC_SUCCESS_PROXY,
  RPC_SUCCESS_TRACKER,
} from 'shocked-common';
import TrackerClient from './TrackerClient';

const EventEmitter = require('events');

const noop = () => {};

function createClient(host, store, Socket = global.WebSocket, network = null) {
  if (!host.startsWith('ws://') && !host.startsWith('wss://')) {
    throw new Error(`Invalid host ${host}. Host should start with ws:// or wss://`);
  }

  if (!store || !store.dispatch || !store.getState || !store.subscribe) {
    throw new Error('Invalid store. Store must be a valid redux store.');
  }

  const parser = createParser();

  let serial = 0;
  let scopeSerial = 0;

  let rpcs = {};
  let scopeCalls = {};
  let scopeManifests = {};
  let trackers = {};

  const eventManager = new EventEmitter();
  const pending = [];

  function deferSend(pkt) {
    pending.push(pkt);
    return () => {
      const idx = pending.indexOf(pkt);
      if (idx >= 0) {
        pending.splice(idx, 1);
      }
    };
  }

  function connection(remoteUrl) {
    if (remoteUrl === null) {
      return null;
    }

    const sock = new Socket(remoteUrl);

    sock.onopen = () => {
      // Execute all the pending calls
      pending.forEach(p => sock.send(p));
      pending.length = 0;

      // Trigger the connect event
      eventManager.emit('connect');
    };

    sock.onmessage = (e) => {
      parser.parse(e.data);
    };

    sock.onclose = () => {
      // Clear all pending, as they will be rejected from below
      pending.length = 0;

      // Reject all rpcs and scopes with termination error
      const rejections = Object.values(rpcs).concat(Object.values(scopeCalls));
      rpcs = {};
      scopeCalls = {};
      // Clear listeners
      Object.keys(trackers).forEach(trackerId => trackers[trackerId].removeAllListeners());
      trackers = {};
      rejections.forEach(([, reject]) => {
        reject(new Error('Connection terminated'));
      });

      // Clear all scope manifests
      scopeManifests = {};

      // Fire the close event on client
      eventManager.emit('disconnect');
    };

    sock.onerror = (e) => {
      const rejections = Object.values(rpcs).concat(Object.values(scopeCalls));
      rpcs = {};
      scopeCalls = {};
      trackers = {};

      // Clear all pending tasks, as they will be rejected from below
      pending.length = 0;

      // Reject all rpcs with error
      rejections.forEach(([, reject]) => {
        reject(e.message);
      });

      // Fire the error event on client
      eventManager.emit('error', e.message);
    };

    return sock;
  }

  parser.onEvent = (event, message) => eventManager.emit(event, message);

  parser.onAction = (action) => {
    store.dispatch(action);
  };

  parser.onTrackerRpcResponse = (serialNum, success, result) => {
    const [resolve, reject] = rpcs[serialNum];
    delete rpcs[serialNum];
    if (success) {
      resolve(result);
    } else {
      reject(result);
    }
  };

  parser.onRpcResponse = (rpcId, success, result) => {
    const [resolve, reject, scopeId] = rpcs[rpcId];
    delete rpcs[rpcId];
    if (success) {
      if (success === RPC_SUCCESS_PROXY) {
        // the result of a proxying
        resolve(result.reduce((res, name) => {
          // eslint-disable-next-line no-use-before-define
          res[name] = (...args) => client.rpc(scopeId, name, ...args);
          return res;
        }, {}));
      } else if (success === RPC_SUCCESS_TRACKER) {
        // eslint-disable-next-line no-use-before-define
        const tracker = new TrackerClient(client, result);
        trackers[tracker.id] = tracker;
        resolve(tracker);
      } else {
        resolve(result);
      }
    } else {
      reject(result);
    }
  };

  parser.onScopeResponse = (tracker, success, result) => {
    const [resolve, reject, scopeId, manifest] = scopeCalls[tracker];
    delete scopeCalls[tracker];
    if (!success) {
      reject(result);
    } else {
      const apis = result || manifest.apis;
      const scopedApi = apis.reduce((res, api) => {
        // eslint-disable-next-line no-use-before-define
        res[api] = (...args) => client.rpc(scopeId, api, ...args);
        return res;
      }, {});

      // Store the scoped api for easy retrieval later
      scopeManifests[scopeId] = scopedApi;

      resolve(scopedApi);
    }
  };

  parser.onTrackerEvent = (trackerId, event, data) => {
    const tracker = trackers[trackerId];
    if (!tracker) {
      return;
    }

    tracker.emit(event, data);
  };

  // Initialize with a connection attempt
  let socket = null;

  const client = {
    isConnected: () => socket && socket.readyState === Socket.OPEN,

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
      socket.close();
      socket = null;
    },

    on: (event, listener) => eventManager.on(event, listener),

    off: (event, listener) => eventManager.off(event, listener),

    call: (scope, api, ...args) => {
      const pkt = PKT_CALL(scope, api, args);
      if (!client.isConnected()) {
        // Add to pending tasks
        return deferSend(pkt);
      }

      // Send the request, its not an rpc, so need to keep track
      socket.send(pkt);
      return noop;
    },

    rpc: (scope, api, ...args) => new Promise((resolve, reject) => {
      serial += 1;
      rpcs[serial] = [resolve, reject, scope];
      const pkt = PKT_RPC_REQUEST(serial, scope, api, args);
      if (!client.isConnected()) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop();
    }),

    trackerRpc: (id, api, ...args) => new Promise((resolve, reject) => {
      serial += 1;
      rpcs[serial] = [resolve, reject];
      const pkt = PKT_TRACKER_RPC_REQUEST(serial, id, api, args);
      if (!client.isConnected()) {
        return deferSend(pkt);
      }
      socket.send(pkt);
      return noop();
    }),

    removeTracker: (id) => {
      trackers[id].removeAllListeners();
      delete trackers[id];
    },

    scope: (name, manifest = null) => new Promise((resolve, reject) => {
      // If the scope has already been manifested, return immediately
      if (scopeManifests[name]) {
        return resolve(scopeManifests[name]);
      }

      scopeSerial += 1;
      scopeCalls[scopeSerial] = [resolve, reject, name, manifest];

      const pkt = PKT_SCOPE_REQUEST(scopeSerial, name, !manifest);
      if (!client.isConnected()) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop;
    }),
  };

  // Setup a network change listener to keep the connection alive
  if (network) {
    network.on('online', () => {
      // Establish a connection as soon as we are online
      if (socket !== null) {
        client.reconnect();
      }
    });

    network.on('offline', () => {
      // close the socket as soon as we go offline
      if (socket !== null) {
        socket.close();
      }
    });
  }

  return client;
}

export default createClient;
