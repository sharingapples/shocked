/* global window */
/* eslint-disable no-underscore-dangle */
import EventEmitter from '@bhoos/eventemitter';

class Network extends EventEmitter {
  constructor() {
    super();
    this._connected = null;

    this._setOnline = this._updateState.bind(this, true);
    this._setOffline = this._updateState.bind(this, false);

    // Start the network listener
    this.start();
  }

  isConnected() {
    return this._connected;
  }

  start() {
    window.addEventListener('online', this._setOnline);
    window.addEventListener('offline', this._setOffline);

    setTimeout(() => {
      this._updateState(window.navigator.onLine);
    }, 1);
  }

  stop() {
    window.removeEventListener('online', this._setOnline);
    window.removeEventListener('offline', this._setOffline);
  }

  _updateState(status) {
    if (this._connected !== status) {
      this._connected = status;
      this.emit(status ? 'online' : 'offline');
    }
  }
}

export default function createNetwork() {
  return new Network();
}
