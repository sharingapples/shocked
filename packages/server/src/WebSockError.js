class WebSockError extends Error {
  constructor(code, reason) {
    super(reason);
    this.code = code;
  }
}

module.exports = WebSockError;
