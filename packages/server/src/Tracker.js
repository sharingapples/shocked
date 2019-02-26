const UrlPattern = require('url-pattern');
const createSession = require('./createSession');

class Tracker {
  constructor(path, apis, validateSession) {
    this.pattern = new UrlPattern(path);
    this.apis = apis;
    this.validateSession = validateSession;

    this.sessions = {};

    this.closeSession = this.closeSession.bind(this);
  }

  closeSession(sessionId) {
    delete this.sessions[sessionId];
  }

  async getSession(sessionId, params, init) {
    // If there is an existing session return that
    let session = this.sessions[sessionId];
    if (!session) {
      session = await createSession(sessionId, params, this.apis, init);
      session.addCloseListener(this.closeSession);
      this.sessions[sessionId] = session;
    }
    return session;
  }

  match(url) {
    return this.pattern.match(url);
  }
}

module.exports = Tracker;
