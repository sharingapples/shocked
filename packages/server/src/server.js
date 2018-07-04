import WebSocket from 'ws';
import UrlPattern from 'url-pattern';

import Session from './Session';
import Channel from './Channel';

import createDefaultProvider from './defaultChannelProvider';

function noop() { }

function beat() {
  this.isAlive = true;
}

export default function start(options, validateSession, pulseRate = 30000) {
  const { url, channelProvider, ...other } = options;

  // Use the channel provider
  Channel.setProvider(channelProvider || createDefaultProvider());

  const urlPattern = url ? new UrlPattern(options.url) : null;

  const wsOptions = {
    ...other,
    verifyClient: (info, cb) => {
      // match the url pattern if available
      const params = urlPattern ? urlPattern.match(info.req.url) : {};
      if (params === null) {
        cb(false, 404, `Can't serve ${info.req.url}`);
        return;
      }

      // eslint-disable-next-line no-param-reassign
      info.req.params = params;
      cb(true);
    },
  };

  const wss = new WebSocket.Server(wsOptions);

  wss.on('connection', (ws, req) => {
    // Create a new session object, in transmit mode, until validated
    const session = new Session(req, req.params, ws);

    Promise.resolve(validateSession(session)).catch((err) => {
      session.emit('error', err.message);
      ws.terminate();
    }).then((res) => {
      if (res || res === undefined) {
        // Enable reception mode
        session.activate(ws);
        // Add heart beat
        if (pulseRate) {
          ws.isAlive = true;    // eslint-disable-line no-param-reassign
          ws.on('pong', beat);
        }

        // TODO: How to handle error condition
        ws.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error(err);
        });
      } else {
        ws.terminate();
      }
    });
  });

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

  // Return an instance of server
  return {
    stop: () => {
      if (heartBeat) {
        clearInterval(heartBeat);
      }

      // Close all client connections
      wss.clients.forEach(client => client.terminate());

      // Close the server
      wss.close();
    },

    length: () => wss.clients.size(),
  };
}
