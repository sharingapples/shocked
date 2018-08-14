const UrlPattern = require('url-pattern');
const Session = require('./Session');

class Service {
  constructor(server, { url, host } = {}) {
    this.server = server;
    this.urlMatcher = url ? new UrlPattern(url) : null;
    this.host = host;
    this.trackers = {};
  }

  registerTracker(name, Tracker) {
    if (!name || !Tracker) {
      throw new Error(`Invalid tracker registration ${name} -> ${Tracker}`);
    }

    if (this.trackers[name]) {
      throw new Error(`Tracker ${name} is already registered`);
    }

    this.trackers[name] = Tracker;
  }

  createTracker(name, channelId, session, params) {
    const Tracker = this.trackers[name];
    if (!Tracker) {
      throw new Error(`No tracker found for ${name}`);
    }

    const channel = this.server.getChannel(channelId);
    return new Tracker(session, channel, params);
  }

  match(request) {
    if (this.host && this.host !== request.headers.host) {
      return false;
    }

    const params = this.urlMatcher ? this.urlMatcher.match(request.url) : {};
    if (params === null) {
      return false;
    }

    return { params };
  }

  validate(inp) {
    if (this.onValidate) {
      console.log('Validate Input', inp);
      return this.onValidate(inp);
    }
    return inp;
  }

  createSession(ws, input) {
    return new Session(this, ws, input);
  }

  start(input, ws) {
    const session = this.createSession(ws, input);
    if (this.onStart) {
      this.onStart(session);
    }
  }
}

module.exports = Service;
