import { createParser, PKT_RPC_REQUEST, PKT_SCOPE_REQUEST, PKT_CALL } from 'redsock-common';

const noop = () => {};

function connect(url, store, Socket = global.WebSocket) {
  const parser = createParser();

  let socket = new Socket(url);
  let serial = 0;
  let scopeSerial = 0;

  let connected = false;
  let rpcs = {};
  let scopeCalls = {};
  const listeners = {};
  const pending = [];

  function fire(event, data) {
    const eventListeners = listeners[event];
    if (eventListeners) {
      eventListeners.forEach(l => l(data));
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
      const apis = Object.keys(result || manifest);
      resolve(apis.reduce((res, api) => {
        // eslint-disable-next-line no-use-before-define
        res[api] = (...args) => client.rpc(api, ...args);
        return res;
      }), {});
    }
  };

  const client = {
    isConnected: () => connected,

    close: () => {
      connected = false;
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

    call: (api, ...args) => {
      const pkt = PKT_CALL(api, args);
      if (!connected) {
        // Add to pending tasks
        return deferSend(pkt);
      }

      // Send the request, its not an rpc, so need to keep track
      socket.send(pkt);
      return noop;
    },

    rpc: (api, ...args) => new Promise((resolve, reject) => {
      serial += 1;
      rpcs[serial] = [resolve, reject];
      const pkt = PKT_RPC_REQUEST(serial, api, args);
      if (!connected) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop();
    }),

    scope: (name, manifest = null) => new Promise((resolve, reject) => {
      scopeSerial += 1;
      scopeCalls[scopeSerial] = [resolve, reject, name, manifest];

      const pkt = PKT_SCOPE_REQUEST(scopeSerial, name, !manifest);
      if (!connected) {
        return deferSend(pkt);
      }

      socket.send(pkt);
      return noop;
    }),
  };

  socket.onopen = () => {
    connected = true;

    // Execute all the pending calls
    pending.forEach(p => socket.send(p));
    pending.length = 0;

    // Trigger the connect event
    fire('connect');
  };

  socket.onmessage = (e) => {
    parser.parse(e.data);
    try {
      const o = JSON.parse(e.data);
      if (!Array.isArray(o)) {
        throw new Error('Unexpected message type');
      }

      const [code, data, args] = o;
      if (code === 0) { // Dispatch event
        store.dispatch(data);
      } else if (code < 0) { // Got an emitted event
        fire(data, args);
      } else if (code > 0) {
        // Looks like rpc callback response
        const r = rpcs[code];
        if (r) {
          const [resolve, reject] = r;
          delete rpcs[code];

          if (data === false) {
            reject(args);
          } else {
            resolve(args);
          }
        }
      }
    } catch (err) {
      console.log('Error processing message', e.data);
      console.error(err);
    }
  };

  socket.onclose = () => {
    connected = false;

    // Clear all pending, as they will be rejected from below
    pending.length = 0;

    // Reject all scope calls with termination error


    // Reject all rpcs and scopes with termination error
    const rejections = Object.values(rpcs).concat(Object.values(scopeCalls));
    rpcs = {};
    scopeCalls = {};
    rejections.forEach(([, reject]) => {
      reject(new Error('Connection terminated'));
    });

    // Fire the close event on client
    fire('disconnect');
  };

  socket.onerror = (e) => {
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

  return client;
}

export default connect;
