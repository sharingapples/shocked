const WebSocket = require('ws');

function noop() { }

function beat() {
  this.isAlive = true;
}

module.exports = function start(server, createSession, pulseRate = 0) {
  const options = (typeof server === 'number') ? ({ port: server }) : server;

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
      const session = createSession(req.url);

      session.dispatch = (action) => {
        ws.send(JSON.stringify([0, action]));
      };

      session.emit = (event, data) => {
        ws.send(JSON.stringify([-1, event, data]));
      };

      if (pulseRate) {
        ws.isAlive = true;    // eslint-disable-line no-param-reassign
        ws.on('pong', beat);
      }

      ws.on('close', () => session.end());
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data);
          if (!Array.isArray(msg)) {
            throw new Error('Socket only supports array messages');
          }

          const [code, name, args] = msg;
          const fn = session.api[name];
          if (code > 0) {
            if (!fn) {
              ws.send(JSON.stringify([code, false, `Unknown api '${name}'`]));
            } else {
              try {
                const res = await fn.apply(session, args);
                ws.send(JSON.stringify([code, true, res]));
              } catch (err) {
                ws.send(JSON.stringify([code, false, err.message]));
              }
            }
          } else if (code === 0) {
            fn.apply(session, args);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
    });
  });
};
