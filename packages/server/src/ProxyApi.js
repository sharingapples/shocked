class ProxyApi {
  constructor(api, ws) {
    this.api = api;
    this.ws = ws;
  }

  send(data) {
    this.ws.send(data);
  }
}

export default ProxyApi;
