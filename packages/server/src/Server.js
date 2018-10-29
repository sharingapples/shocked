const http = require('http');
const WebSocket = require('ws');
const debug = require('debug')('shocked');

const pkg = require('../package.json');

function beat() {
  this.isAlive = true;
}

const defaultHttpHandler = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end(`${pkg.name}@${pkg.version}`);
};

const wss = new WebSocket.Server({ noServer: true });

function createServer({
  pulseRate = 30000,
  httpHandler = defaultHttpHandler,
  logger = null,
} = {}) {
  const services = [];
  const httpServer = http.createServer(httpHandler);

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

  // Setup a heart beat if a pulse rate is given
  const heartBeat = pulseRate > 0 ? setInterval(keepAlive, pulseRate) : null;

  // The singleton server object
  const server = {
    serve: (service) => {
      services.push(service);
      return service;
    },

    start: async ({ port }) => new Promise((resolve, reject) => {
      try {
        httpServer.listen(port, resolve);
      } catch (err) {
        reject(err);
      }
    }),

    stop: () => {
      if (heartBeat) {
        clearInterval(heartBeat);
      }

      // Close all the services
      services.forEach(service => service.close());

      // Close the main server
      httpServer.close();
    },
  };

  // Setup the http server to handle websocket upgrade
  httpServer.on('upgrade', async (request, socket, head) => {
    debug(`Upgrade request ${socket.remoteAddress}:${socket.remotePort}/${request.url}`);
    // Search for the first registered service that can handle
    // this request. (By URL or header)
    let reqParams = null;
    const service = services.find((s) => {
      reqParams = s.match(request);
      return reqParams;
    });

    if (!reqParams) {
      // End the request
      return wss.handleUpgrade(request, socket, head, (ws) => {
        debug(`No matching request found for ${request.url} host: ${request.headers.host}`);
        ws.close(4002, `No service found at ${request.url}`);
      });
    }

    // Try to validate the request Parameters
    try {
      reqParams = await service.validate(reqParams) || reqParams;
    } catch (err) {
      return wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, err.message);
      });
    }

    // Everything's ok, start the session
    return wss.handleUpgrade(request, socket, head, (ws) => {
      debug(`New connection. Total connections: ${wss.clients.size}`);
      // Attach the ping-pong handler
      if (pulseRate > 0) {
        // Mark the socket as alive as soon as a connection is made
        // eslint-disable-next-line no-param-reassign
        ws.isAlive = true;
        ws.on('pong', beat);
      }

      // Add error handler to avoid crashing on errors
      // There is nothing we could do when an error occurs, since the
      // socket is always closed after the error.
      ws.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
          debug('Session socket error', err);
        }
      });

      if (process.env.NODE_ENV === 'development') {
        ws.on('close', () => {
          debug(`Closing connection. Total connections: ${wss.clients.size}`);
        });
      }

      debug(`Start session for ${socket.remoteAddress}:${socket.remotePort}`);
      service.start(reqParams, ws, logger);
    });
  });

  return server;
}

module.exports = createServer;
