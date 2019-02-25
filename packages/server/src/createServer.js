const http = require('http');
const WebSocket = require('ws');
const { SESSION } = require('shocked-common');

const defaultHttpHandler = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end('Noop');
};

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

function createServer({
  httpHandler = defaultHttpHandler,
  pulseRate = 30000,
} = {}) {
  const trackers = [];
  const httpServer = http.createServer(httpHandler);

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
            const serial = JSON.parse(msg);

            // Retreive the session
            const session = await tracker.getSession(sessionId, reqParams, serial, initSession);
            session.attach(ws);

            // Add a heart beat only after the session has been created
            // This will make sure that the session is closed when no sync
            // event is received within a heart beat check interval
            if (pulseRate > 0) {
              // eslint-disable-next-line no-param-reassign
              ws.isAlive = true;
              ws.on('pong', beat);
            }
          } catch (err) {
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

  return {
    listen: (port = 0) => new Promise((resolve, reject) => {
      try {
        const listener = httpServer.listen(port, () => {
          resolve(listener.address().port);
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
      });

      // Close the main server
      httpServer.close();
    },
  };
}

module.exports = createServer;
