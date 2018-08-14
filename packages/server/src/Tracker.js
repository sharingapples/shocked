class Tracker {
  constructor(session, channel, params) {
    this.session = session;
    this.channel = channel;
    this.paramUpdates = params;
    this.apis = {};

    this.channel.subscribe(session);

    if (this.onCreate) {
      console.log('Creating tracker', this.constructor.name);
      this.onCreate();
    }
  }

  get serial() {
    return this.channel.getSerial();
  }

  getApis() {
    return Object.keys(this.apis);
  }

  registerApi(name, fn) {
    if (this.apis[name]) {
      throw new Error(`Api ${name} is already registered with ${this.constructor.name}`);
    }

    if (typeof fn !== 'function') {
      throw new Error(`Api ${this.constructor.name}::${name} is not a function`);
    }

    console.log(this.constructor.name, 'Registering api', name);
    this.apis[name] = fn;
  }

  registerApis(...args) {
    args.forEach((fn) => {
      this.registerApi(fn.name, fn);
    });
  }

  async executeApi(name, ...args) {
    const api = this.apis[name];
    if (!api) {
      throw new Error(`Unknown api ${this.constructor.name}::${name}`);
    }
    return api(...args);
  }

  updateParams(params) {
    Object.assign(this.paramUpdates, params);
  }

  // Get the actions available from the channel that could
  // update the tracker with the global state of the channel
  async getActions(serialNumber) {
    return this.channel.getActions(serialNumber);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async getData(params) {
    throw new Error('Tracker must implement getData() method');
  }

  close() {
    const n = this.channel.unsubscribe(this.session);
    if (n === 0) {
      // Cleanup the channel
      this.session.service.server.clearChannel(this.channel.id);
    }
  }

  dispatch(action) {
    this.channel.dispatch(action);
  }
}

module.exports = Tracker;
