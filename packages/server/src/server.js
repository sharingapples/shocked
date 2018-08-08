import http from 'http';
import WebSocket from 'ws';
import UrlPattern from 'url-pattern';

import Session from './Session';
import Channel from './Channel';

import createDefaultProvider from './defaultChannelProvider';

const pkg = require('../package.json');

const debug = require('debug')('shocked');

function noop() { }

function beat() {
  this.isAlive = true;
}

const defaultHttpHandler = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.end(`${pkg.name}@${pkg.version}`);
};

export default function shocked({
  port,
  pulseRate = 30000,
  httpHandler = defaultHttpHandler,
  channelProvider,
} = {}) {
  if (arguments.length > 1) {
    throw new Error('Please use the handler returned to add url specific handler. New version');
  }

  if (!port) {
    throw new Error('Provide a port to listen on');
  }

  Channel.setProvider(channelProvider || createDefaultProvider());
  const handlers = [];

  const server = http.createServer(httpHandler);
  const errHandler = new WebSocket.Server({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    function end(code, message) {
      errHandler.handleUpgrade(request, socket, head, (ws) => {
        ws.close(code, message);
      });
    }

    // Search for a handler that can handle this request
    const h = handlers.reduce((res, handler) => {
      if (res) {
        return res;
      }

      const params = handler.urlPattern.match(request.url);
      if (params === null) {
        return null;
      }

      return {
        wss: handler.wss,
        validator: handler.validator,
        params,
      };
    }, null);

    if (h === null) {
      return end(4001, 'No handler');
    }

    // First try to validate session
    const session = new Session(h.params);
    try {
      const r = await h.validator(session);
      if (r === false) {
        throw new Error('Session is not validated');
      }
    } catch (err) {
      debug('Session validation failed', err);
      return end(4002, err.message);
    }

    // Everything went ok, upgrade the websocket request
    return h.wss.handleUpgrade(request, socket, head, (ws) => {
      // First activate the session
      session.activate(ws);

      if (pulseRate > 0) {
        ws.isAlive = true;  // eslint-disable-line
        ws.on('pong', beat);
      }
    });
  });

  const keepAlive = () => {
    handlers.forEach(({ wss }) => wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
      }

      ws.isAlive = false; // eslint-disable-line
      ws.ping(noop);
    }));
  };

  const heartBeat = pulseRate > 0 ? setInterval(keepAlive, pulseRate) : null;

  server.listen(port, () => {
    if (handlers.length === 0) {
      throw new Error('No handlers defined');
    }

    debug(`Server listening at port ${port}`);
  });

  return {
    handle: (url, validator) => {
      const handler = {
        urlPattern: new UrlPattern(url),
        validator,
        wss: new WebSocket.Server({ noServer: true }),
      };
      handlers.push(handler);

      return {
        length: () => handler.wss.clients.size,
      };
    },

    quit: () => {
      if (heartBeat) {
        clearInterval(heartBeat);
      }

      handlers.forEach(({ wss }) => {
        // Terminate all clients
        wss.clients.forEach(c => c.terminate());

        // Terminate the server
        wss.close();
      });
    },
  };
}
