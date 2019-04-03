const { IDENT, RECONN } = require('shocked-common');
const UrlPattern = require('url-pattern');
const Session = require('./Session');

// Expire abandoned sessions in 5 minutes
const SESSION_EXPIRY = 5 * 60 * 1000;

class IdentError extends Error {
  constructor(ident) {
    super(`Unknown ident - ${JSON.stringify(ident)}`);
    this.code = 4002;
  }
}

function registerHandler(source, cb) {
  if (typeof cb !== 'function') {
    throw new Error('Callbacks should be a function');
  }

  if (source.indexOf(cb) !== -1) {
    throw new Error('Do not register same callback more than once');
  }

  source.push(cb);
  return () => {
    const idx = source.indexOf(cb);
    if (idx >= 0) {
      source.splice(idx, 1);
    }
  };
}

class Tracker {
  constructor(path) {
    this.pattern = new UrlPattern(path);

    this.api = null;
    this.orphans = {};

    this.identifiers = [];
    this.initializers = [];
    this.contextHandlers = [];

    this.onIdentify = this.onIdentify.bind(this);
    this.onReconnect = this.onReconnect.bind(this);
  }

  register(api) {
    if (this.api) throw new Error('Api can only be registered once');
    this.api = api;
  }

  onIdent(cb) {
    return registerHandler(this.identifiers, cb);
  }

  onStart(cb) {
    return registerHandler(this.initializers, cb);
  }

  onContext(cb) {
    return registerHandler(this.contextHandlers, cb);
  }

  getParser(type) {
    if (type === IDENT) return this.onIdentify;
    if (type === RECONN) return this.onReconnect;
    return null;
  }

  abandon(session) {
    this.orphans[session.id] = {
      session,
      timeout: setTimeout(() => {
        this.destroy(session);
      }, SESSION_EXPIRY),
    };
  }

  destroy(session) {
    session.unsubscribeAll();
    const res = this.orphans[session.id];
    if (res) {
      clearTimeout(res.timeout);
      delete this.orphans[session.id];
    }
  }

  async onIdentify(ws, params, ident, context) {
    const user = await this.identifiers.reduce((res, identifier) => {
      return res.then((identified) => {
        if (identified) return identified;
        return identifier(ident);
      });
    }, Promise.resolve(null));

    if (!user) {
      throw new IdentError(ident);
    }

    if (user) {
      // Found a valid user for creating a session
      const session = new Session(this, user, params);
      session.attach(ws);

      // Start the session as well
      await this.initializers.reduce((res, onStart) => {
        return res.then(() => onStart(session));
      }, Promise.resolve(null));

      // Setup context
      await session.onInit(context);

      // Let the client know that we are now identified
      return session.identified();
    }

    return null;
  }

  async onReconnect(ws, params, sessionId, serial) {
    const res = this.orphans[sessionId];
    if (!res) {
      ws.close(4001, 'Unknown session');
      return false;
    }

    const { timeout, session } = res;
    clearTimeout(timeout);
    session.attach(ws);
    await session.sync(serial);
    return session.identified();
  }

  process(ws, params) {
    return new Promise((resolve, reject) => {
      ws.once('message', async (data) => {
        try {
          const msg = JSON.parse(data);
          if (!Array.isArray(msg)) {
            throw new Error('Invalid message type');
          }
          const parser = this.getParser(msg[0]);
          if (!parser) { throw new Error('Unknown message type'); }
          await parser(ws, params, ...msg.slice(1));
          return resolve(true);
        } catch (err) {
          return reject(err);
        }
      });
    });
  }

  match(url) {
    return this.pattern.match(url);
  }
}

module.exports = Tracker;
