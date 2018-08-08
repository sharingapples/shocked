class ProxyApi {
  constructor(forward, ws) {
    this.forward = forward;
    this.ws = ws;
  }

  send(data) {
    this.ws.send(data);
  }
}

export default ProxyApi;
