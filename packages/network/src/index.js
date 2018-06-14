/* eslint-disable no-underscore-dangle */

const dns = require('dns');
const EventEmitter = require('events');

const ONLINE = 'online';
const OFFLINE = 'offline';

const DEFAULT_DOMAIN = 'google.com';
const DEFAULT_POLL_INTERVAL = 5000;

const defaultConfig = {
  domain: DEFAULT_DOMAIN,
  poll: DEFAULT_POLL_INTERVAL,
};

function poll(network) {
  dns.resolve(network.domain, (err) => {
    // Use the call back response only if the network check is active
    if (network.active) {
      const timerHandle = setTimeout(() => poll(network), network.pollInterval);
      if (err) {
        network._updateState(false, timerHandle);
      } else {
        network._updateState(true, timerHandle);
      }
    }
  });
}

class Network extends EventEmitter {
  constructor(config) {
    super();
    this.domain = config.domain || DEFAULT_DOMAIN;
    this.pollInterval = config.poll || DEFAULT_POLL_INTERVAL;

    this.connected = null;
    this.timerHandle = null;
    this.active = false;

    // By default start the detector
    this.start();
  }

  _updateState(status, timerHandle) {
    this.timerHandle = timerHandle;
    if (this.connected !== status) {
      this.connected = status;
      this.emit(status ? ONLINE : OFFLINE);
    }
  }

  isConnected() {
    return this.connected;
  }

  start() {
    if (!this.active) {
      this.active = true;
      poll(this);
    }
  }

  stop() {
    if (this.active) {
      this.active = false;
      clearTimeout(this.timerHandle);
    }
  }
}

module.exports = (config = defaultConfig) => new Network(config);