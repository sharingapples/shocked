const http = require('http');
const WebSocket = require('ws');
const polka = require('polka');
const setupDebugger = require('../debug');

const Tracker = require('./Tracker');
const WebSockError = require('./WebSockError');

const wss = new WebSocket.Server({ noServer: true });

function beat() {
  this.isAlive = true;
}

function keepAlive() {
  wss.clients.forEach((client) => {
    if (!client.isAlive) {
      return client.terminate();
    }

    // eslint-disable-next-line no-param-reassign
    client.isAlive = false;
    if (client.readyState !== WebSocket.OPEN) return null;
    return client.ping();
  });
}

function createServer({ pulseRate = 30000, killTimeout = 1000 } = {}) {
  const trackers = [];
  const httpServer = http.createServer();

  const heartBeat = pulseRate > 0 ? setInterval(keepAlive, pulseRate) : null;

  httpServer.on('upgrade', async (request, socket, head) => {
    let reqParams = {};

    const tracker = trackers.find((t) => {
      const params = t.match(request.url);
      if (!params) {
        return false;
      }

      reqParams = params;
      return true;
    });

    // eslint-disable-next-line consistent-return
    wss.handleUpgrade(request, socket, head, async (ws) => {
      function close(code, message) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(code, message);
        }
      }

      // Early exit
      if (!tracker) return close(4004, `No tracker found at ${request.url}`);

      // Setup a kill timer to close the socket
      const killTimer = setTimeout(() => {
        close(4004, 'KillTimeout before first frame');
      }, killTimeout);

      try {
        if (await tracker.process(ws, reqParams)) {
          // Setup pulse tracker
          if (pulseRate > 0) {
            // eslint-disable-next-line no-param-reassign
            ws.isAlive = true;
            ws.on('pong', beat);
          }
        }
        clearTimeout(killTimer);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        const code = err instanceof WebSockError ? err.code : 4004;
        close(code, err.message);
      }

      ws.on('error', (err) => {
        clearTimeout(killTimer);
        // eslint-disable-next-line no-console
        console.error('WebSocket::Error', err);
      });
    });
  });

  const app = polka({ server: httpServer });

  if (process.env.NODE_ENV === 'development') {
    setupDebugger(app, trackers);
  }

  return {
    use: app.use.bind(app),
    get: app.get.bind(app),
    post: app.post.bind(app),
    put: app.put.bind(app),
    delete: app.delete.bind(app),
    patch: app.patch.bind(app),
    head: app.head.bind(app),

    listen: (port = 0) => new Promise((resolve, reject) => {
      try {
        app.listen(port, () => {
          resolve(httpServer.address().port);
        });
      } catch (err) {
        reject(err);
      }
    }),

    track: (path, satellite) => {
      const tracker = new Tracker(path);
      satellite(tracker);
      trackers.push(tracker);
    },
    close: () => {
      if (heartBeat) {
        clearInterval(heartBeat);
      }

      // Close all the clients
      wss.clients.forEach((client) => {
        client.close();
      });

      // Close the main server
      httpServer.close();
    },
  };
}

module.exports = createServer;
