const http = require('http');
const WebSocket = require('ws');

const pkg = require('../package.json');
const DefaultChannel = require('./DefaultChannel');

function beat() {
  this.isAlive = true;
}

const defaultHttpHandler = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end(`${pkg.name}@${pkg.version}`);
};

const wss = new WebSocket.Server({ noServer: true });


function createServer({
  pulseRate = 0,
  Channel = DefaultChannel,
  httpHandler = defaultHttpHandler,
} = {}) {
  const services = [];
  const channels = {};
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

    getChannel: (id) => {
      if (id in channels) {
        return channels[id];
      }

      const channel = new Channel(id);
      if (channel.onCreate) {
        channel.onCreate();
      }
      channels[id] = channel;
      return channel;
    },

    clearChannel: (id) => {
      if (id in channels) {
        // Invoke the destroy event
        const channel = channels[id];
        if (channel.onDestroy) {
          channel.onDestroy();
        }
        delete channels[id];
      }
    },
  };

  // Setup the http server to handle websocket upgrade
  httpServer.on('upgrade', async (request, socket, head) => {
    // Search for the first registered service that can handle
    // this request. (By URL or header)
    let req = null;
    const service = services.find((s) => {
      req = s.match(request);
      return req;
    });

    if (!req) {
      // End the request
      return wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4002, `No service found at ${request.url}`);
      });
    }

    // Try to validate the req
    try {
      console.log('Validate request', req);
      await service.validate(req);
    } catch (err) {
      console.error(err);
      return wss.handleUpgrade(request, socket, head, (ws) => {
        ws.close(4001, err.message);
      });
    }

    console.log('upgrade ws to session');
    // Everything's ok, start the session
    return wss.handleUpgrade(request, socket, head, (ws) => {
      // Attach the ping-pong handler
      if (pulseRate > 0) {
        ws.on('pong', beat);
      }

      service.start(req, ws, server);
    });
  });

  return server;
}

module.exports = createServer;
