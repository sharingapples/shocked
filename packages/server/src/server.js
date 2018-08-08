import WebSocket from 'ws';
import UrlPattern from 'url-pattern';

import Session from './Session';
import Channel from './Channel';

import createDefaultProvider from './defaultChannelProvider';

const debug = require('debug')('shocked');

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
        debug(`Could not process url ${info.req.url}`);
        cb(false, 404, `Can't serve ${info.req.url}`);
        return;
      }

      const session = new Session(params);
      // eslint-disable-next-line no-param-reassign
      info.req.session = session;

      Promise.resolve(validateSession(session)).catch((err) => {
        debug('Error while validating session', err);
        cb(false, 500, err.message);
      }).then((res) => {
        if (res === false) {
          debug('Session rejected by application, validation returned `false`');
          cb(false, 500, 'Session rejected by application');
        } else {
          cb(true);
        }
      });
    },
  };

  const wss = new WebSocket.Server(wsOptions);

  wss.on('connection', (ws, req) => {
    // Create a new session object, in transmit mode, until validated
    const { session } = req;
    session.activate(ws);

    if (pulseRate) {
      ws.isAlive = true; // eslint-disable-line no-param-reassign
      ws.on('pong', beat);
    }

    ws.on('error', (err) => {
      debug('Unexpected websocket error', err);
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

    length: () => wss.clients.size,
  };
}
