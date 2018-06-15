/* eslint-disable no-underscore-dangle */

// eslint-disable-next-line
import { NetInfo } from 'react-native';
import EventEmitter from '@bhoos/eventemitter';

class Network extends EventEmitter {
  constructor() {
    super();
    this._connected = null;

    // Start the network listener
    this.start();
  }


  isConnected() {
    return this._connected;
  }

  _updateState(status) {
    if (this._connected !== status) {
      this._connected = status;

      this.emit(status ? 'online' : 'offline');
    }
  }

  _onConnectionChange = (isConnected) => {
    this._updateState(isConnected);
  }

  start() {
    NetInfo.isConnected.addEventListener(
      'connectionChange',
      this._onConnectionChange
    );

    // Find the initial connection status
    NetInfo.isConnected.fetch().then((isConnected) => {
      this._updateState(isConnected);
    });
  }

  stop() {
    NetInfo.isConnected.removeEventListener(
      'connectionChange',
      this._onConnectionChange
    );
  }
}

export default function createNetwork() {
  return new Network();
}
