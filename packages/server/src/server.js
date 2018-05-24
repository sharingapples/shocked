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

      // Create a session object
      const session = new Session(info.req, params);
      Promise.resolve(validateSession(session)).then(() => {
        // eslint-disable-next-line no-param-reassign
        info.req.session = session;
        cb(true);
      }).catch((err) => {
        cb(false, 500, err.message);
      });
    },
  };

  const wss = new WebSocket.Server(wsOptions);

  wss.on('connection', (ws, req) => {
    // Get the session created by verifyClient above
    const { session } = req;

    // Activate the session
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
      wss.clients.forEach(ws => ws.close());

      // Close the server
      wss.close();
    },

    length: () => wss.clients.size(),
  };
}
