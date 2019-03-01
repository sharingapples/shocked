const http = require('http');
const WebSocket = require('ws');
const { SESSION } = require('shocked-common');
const polka = require('polka');
const setupDebugger = require('../debug');

const Tracker = require('./Tracker');

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
    return client.ping();
  });
}

function getSessionId(req) {
  const { cookie } = req.headers;
  if (!cookie) {
    return null;
  }

  const key = `${SESSION}=`;
  return cookie.split(';').reduce((res, v) => {
    if (res === null && v.startsWith(key)) {
      return v.substr(key.length);
    }
    return res;
  }, null);
}

function createServer({ pulseRate = 30000 } = {}) {
  const trackers = [];
  const httpServer = http.createServer();

  const heartBeat = pulseRate > 0 ? setInterval(keepAlive, pulseRate) : null;

  httpServer.on('upgrade', async (request, socket, head) => {
    let reqParams = null;

    // Make sure we have a valid session cookie
    const sessionId = getSessionId(request);

    const tracker = trackers.find((t) => {
      const params = t.match(request.url);
      if (!params) {
        return false;
      }

      reqParams = params;
      return true;
    });

    try {
      if (!tracker) {
        throw new Error(`No tracker found at ${request.url}`);
      }

      const initSession = await tracker.validateSession(reqParams, sessionId);
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.on('error', () => {

        });

        // Run the populate method or sync as required
        ws.once('message', async (msg) => {
          try {
            const [serial, context] = JSON.parse(msg);
            // Retreive the session
            const session = await tracker.getSession(sessionId, reqParams, initSession);
            session.attach(ws, serial, context);

            // Add a heart beat only after the session has been created
            // This will make sure that the session is closed when no sync
            // event is received within a heart beat check interval
            if (pulseRate > 0) {
              // eslint-disable-next-line no-param-reassign
              ws.isAlive = true;
              ws.on('pong', beat);
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(err.message);
            ws.close(4002, err.message);
          }
        });
      });
    } catch (err) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, err.message);
      });
    }
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
          resolve(port);
        });
      } catch (err) {
        reject(err);
      }
    }),

    track: (path, apis, sessionValidator) => {
      trackers.push(new Tracker(path, apis, sessionValidator));
    },
    close: () => {
      if (heartBeat) {
        clearInterval(heartBeat);
      }

      // Close all the clients
      wss.clients.forEach((client) => {
        client.close();
        trackers.forEach((tracker) => {
          tracker.close();
        });
      });

      // Close the main server
      httpServer.close();
    },
  };
}

module.exports = createServer;
