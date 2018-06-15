/* eslint-disable no-underscore-dangle */
import { Resolver } from 'dns';

const EventEmitter = require('events');

const ONLINE = 'online';
const OFFLINE = 'offline';

const DEFAULT_DOMAIN = 'google.com';
const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_TIMEOUT_INTERVAL = 3000;

const defaultConfig = {
  domain: DEFAULT_DOMAIN,
  poll: DEFAULT_POLL_INTERVAL,
  timeout: DEFAULT_TIMEOUT_INTERVAL,
  servers: null,
};

class Network extends EventEmitter {
  constructor(config) {
    super();
    this._domain = config.domain || DEFAULT_DOMAIN;
    this._pollInterval = config.poll || DEFAULT_POLL_INTERVAL;
    this._timeoutInterval = config.timeout || DEFAULT_TIMEOUT_INTERVAL;
    this._servers = config.servers || null;

    this._resolver = null;
    this._connected = null;
    this._timerHandle = null;

    // By default start the detector
    this.start();
  }

  _updateState(status) {
    if (this._connected !== status) {
      this._connected = status;

      super.emit(status ? ONLINE : OFFLINE);
    }
  }

  isConnected() {
    return this._connected;
  }

  start() {
    if (this._resolver !== null) {
      throw new Error('Network could be started only once');
    }

    // Create the resolver
    this._resolver = new Resolver();
    if (this._servers) {
      this._resolver.setServers(this._servers);
    }

    // Starts polling
    this._poll();
  }

  stop() {
    if (this._resolver) {
      this._resolver.cancel();
      this._resolver = null;

      // Also clear the poll handle
      clearTimeout(this._timerHandle);
    }
  }

  _poll() {
    // A timeout to wait for a dns resolution, will declare the network as offline if
    // the query is not resolved within this period
    const timeout = setTimeout(() => {
      this._updateState(false);
    }, this._timeoutInterval);

    this._resolver.resolve(this._domain, (err) => {
      // Clear the timeout interval
      clearTimeout(timeout);
      // Update the connection state
      if (err) {
        if (err.code === 'ECANCELLED') {
          // If the resolution was cancelled, happens only when the network is stopped
          // Just leave without doing anything
          return;
        }

        this._updateState(false);
      } else {
        this._updateState(true);
      }

      // Once resolved, try again after poll interval
      this._timerHandle = setTimeout(() => this._poll(), this._pollInterval);
    });
  }
}

export default function createNetwork(config = defaultConfig) {
  return new Network(config);
}
