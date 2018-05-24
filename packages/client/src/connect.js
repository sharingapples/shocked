import { createParser, PKT_RPC_REQUEST, PKT_SCOPE_REQUEST, PKT_CALL } from 'redsock-common';

const noop = () => {};

function connect(url, store, Socket = global.WebSocket) {
  const parser = createParser();

  let serial = 0;
  let scopeSerial = 0;

  let rpcs = {};
  let scopeCalls = {};
  let scopeManifests = {};

  const listeners = {};
  const pending = [];

  function fire(event, data) {
    const eventListeners = listeners[event];
    if (eventListeners) {
      // Call the listener with client as `this` instance
      // eslint-disable-next-line no-use-before-define
      eventListeners.forEach(l => l.call(client, data));
    }
  }

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
    const sock = new Socket(remoteUrl);

    sock.onopen = () => {
      // Execute all the pending calls
      pending.forEach(p => sock.send(p));
      pending.length = 0;

      // Trigger the connect event
      fire('connect');
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
      rejections.forEach(([, reject]) => {
        reject(new Error('Connection terminated'));
      });

      // Clear all scope manifests
      scopeManifests = {};

      // Fire the close event on client
      fire('disconnect');
    };

    sock.onerror = (e) => {
      const rejections = Object.values(rpcs).concat(Object.values(scopeCalls));
      rpcs = {};
      scopeCalls = {};

      // Clear all pending tasks, as they will be rejected from below
      pending.length = 0;

      // Reject all rpcs with error
      rejections.forEach(([, reject]) => {
        reject(e.message);
      });

      // Fire the error event on client
      fire('error', e.message);
    };

    return sock;
  }

  // Make the first connection
  let socket = connection(url);

  parser.onEvent = fire;
  parser.onAction = (action) => {
    store.dispatch(action);
  };

  parser.onRpcResponse = (tracker, success, result) => {
    const [resolve, reject] = rpcs[tracker];
    delete rpcs[tracker];
    if (success) {
      resolve(result);
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

  const client = {
    isConnected: () => socket.readyState === Socket.OPEN,

    reconnect: (remoteUrl = null) => {
      const finalUrl = remoteUrl || url;
      // Only perform a reconnect if the socket is not connected or the url has changed
      if (socket.url !== finalUrl || socket.readyState !== Socket.OPEN) {
        // Make sure to cleanup the previous socket
        socket.close();

        // Perform a new connection
        socket = connection(finalUrl);

        // The reconnection has been attempted
        return true;
      }

      // No reattempt needed
      return false;
    },

    close: () => {
      socket.close();
      socket = null;
    },

    on: (event, listener) => {
      // Keep track of event listeners
      const eventListeners = listeners[event];
      if (!eventListeners) {
        listeners[event] = [listener];
      } else {
        eventListeners.push(listener);
      }

      return () => {
        listeners[event] = listeners[event].filter(l => l === listener);
      };
    },

    call: (scope, api, ...args) => {
      const pkt = PKT_CALL(scope, api, args);
      if (socket.readyState !== Socket.OPEN) {
        // Add to pending tasks
        return deferSend(pkt);
      }

      // Send the request, its not an rpc, so need to keep track
      socket.send(pkt);
      return noop;
    },

    rpc: (scope, api, ...args) => new Promise((resolve, reject) => {
      serial += 1;
      rpcs[serial] = [resolve, reject];
      const pkt = PKT_RPC_REQUEST(serial, scope, api, args);
      if (socket.readyState !== Socket.OPEN) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop();
    }),

    scope: (name, manifest = null) => new Promise((resolve, reject) => {
      // If the scope has already been manifested, return immediately
      if (scopeManifests[name]) {
        return resolve(scopeManifests[name]);
      }

      scopeSerial += 1;
      scopeCalls[scopeSerial] = [resolve, reject, name, manifest];

      const pkt = PKT_SCOPE_REQUEST(scopeSerial, name, !manifest);
      if (socket.readyState !== Socket.OPEN) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop;
    }),
  };

  return client;
}

export default connect;
