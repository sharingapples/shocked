const WebSocket = require('ws');

function noop() { }

function beat() {
  this.isAlive = true;
}

module.exports = function start(server, createSession, pulseRate = 30000) {
  const options = (typeof server === 'number') ? ({ port: server }) : ({ server });

  // Add a client verfication method
  options.verifyClient = async (info, cb) => {
    try {
      const session = await createSession(info.req.url, info.req, info);
      if (session === null) {
        cb(false, 401, 'Unauthorized access');
      } else {
        // eslint-disable-next-line no-param-reassign
        info.req.session = session;
        cb(true);
      }
    } catch (err) {
      cb(false, 500, err.message);
    }
  };

  return new Promise((resolve, reject) => {
    const wss = new WebSocket.Server(options, (err) => {
      if (err) {
        return reject(err);
      }

      function keepAlive() {
        wss.clients.forEach((ws) => {
          if (!ws.isAlive) {
            return ws.terminate();
          }

          // eslint-disable-next-line no-param-reassign
          ws.isAlive = false;
          return ws.ping(noop);
        });
      }

      const heartBeat = pulseRate > 0 ? setInterval(keepAlive, pulseRate) : null;

      return resolve(() => {
        if (heartBeat) {
          clearInterval(heartBeat);
        }
        wss.clients.forEach(ws => ws.close());
        wss.close();
      });
    });

    wss.on('connection', (ws, req) => {
      // Get the session created by verifyClient above
      const { session } = req;
      // If a session could not be established close the socket with a error message
      // Highly unlikely error
      if (!session) {
        // ws.emit('error', 'Could not start a session');
        ws.close();
        return;
      }

      // Add method to dispatch actions on remote clients
      session.dispatch = (action) => {
        // Only if the session is open are we able to dispatch
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify([0, action]));
          return;
        }

        if (ws.readyState === ws.CLOSED) {
          // eslint-disable-next-line no-console
          console.error('One of your session is already closed and can\'t dispatch. Did you forget to clear the session on your app using addCloseListener!!');
        }
      };

      // Add method to emit events on remote clients
      session.emit = (event, data) => {
        // Only if the session is open we are able to emit
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify([-1, event, data]));
        }

        if (ws.readyState === ws.CLOSED) {
          // eslint-disable-next-line no-console
          console.error('One of your session is already closed and can\'t emit. Did you forget to clear the session on your app using addCloseListener!!');
        }
      };

      // Allow server side to close the session as well
      session.close = () => {
        setImmediate(() => ws.close());
      };

      session.addCloseListener = (listener) => {
        ws.on('close', listener);
      };

      let api = null;
      try {
        api = session.onStart(session);
        // The api should be created synchronously, can't allow a Promise or a non object
        if (api === null || api instanceof Promise || typeof api !== 'object') {
          throw new Error('The api provided for a session should be a object. You cannot return a promise here.');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        ws.close();
        return;
      }

      if (pulseRate) {
        ws.isAlive = true;    // eslint-disable-line no-param-reassign
        ws.on('pong', beat);
      }

      // In case of any error, close the socket
      ws.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data);
          if (!Array.isArray(msg)) {
            throw new Error('Socket only supports array messages');
          }

          const [code, name, args] = msg;
          const fn = api[name];
          if (code > 0) {
            if (!fn) {
              ws.send(JSON.stringify([code, false, `Unknown api '${name}'`]));
            } else {
              let success = true;
              let result = null;
              try {
                result = await fn.apply(api, args);
              } catch (err) {
                // Log the error message for verbosity
                // eslint-disable-next-line no-console
                console.error(err);
                success = false;
                result = err.message;
              }

              if (ws.readyState === ws.OPEN) {
                // There is a possiblity that while waiting for the api to complete,
                // The socket has been closed
                ws.send(JSON.stringify([code, success, result]));
              }
            }
          } else if (code === 0) {
            fn.apply(api, args);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
  });
};
