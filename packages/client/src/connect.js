const noop = () => {};

function connect(url, store, Socket = global.WebSocket) {
  let socket = new Socket(url);
  let serial = 0;

  let connected = false;
  let rpcs = {};
  const listeners = {};
  const pending = [];

  function fire(event, data) {
    const eventListeners = listeners[event];
    if (eventListeners) {
      eventListeners.forEach(l => l(data));
    }
  }

  function deferCall(sn, name, args) {
    const c = [sn, name, args];
    pending.push(c);
    return () => {
      const idx = pending.indexOf(c);
      if (idx >= 0) {
        pending.splice(idx, 1);
      }
    };
  }


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
      if (!connected) {
        // Add to pending tasks
        return deferCall(0, api, args);
      }

      // Send the request, its not an rpc, so need to keep track
      socket.send(JSON.stringify([0, api, args]));
      return noop;
    },

    rpc: (api, ...args) => new Promise((resolve, reject) => {
      serial += 1;
      rpcs[serial] = [resolve, reject];

      if (!connected) {
        return deferCall(serial, api, args);
      }

      socket.send(JSON.stringify([serial, api, args]));
      return noop();
    }),
  };

  socket.onopen = () => {
    connected = true;

    // Execute all the pending calls
    pending.forEach(p => socket.send(JSON.stringify(p)));

    // Trigger the connect event
    fire('connect');
  };

  socket.onmessage = (e) => {
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

    // Reject all rpcs with termination error
    const rejections = Object.values(rpcs);
    rpcs = {};
    rejections.forEach(([, reject]) => {
      reject(new Error('Connection terminated'));
    });

    // Fire the close event on client
    fire('disconnect');
  };

  socket.onerror = (e) => {
    const rejections = Object.values(rpcs);
    rpcs = {};

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
