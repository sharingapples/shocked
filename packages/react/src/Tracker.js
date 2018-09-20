import React, { Component } from 'react';
import { createStore } from 'redux';
import { createProvider } from 'react-redux';
import { enhanceReducer } from 'shocked-client';
import { Consumer } from './Shocked';

function track(trackerId, reducer, extend) {
  const Provider = createProvider(trackerId);

  return Target => class Tracker extends Component {
    componentWillUnmount() {
      if (this.tracker) {
        this.tracker.close();

        // Unregister all the event handlers
        this.tracker.removeListener('init', this.onInit);
        this.tracker.client.off('connect', this.onConnect);
        this.tracker.client.off('disconnect', this.onDisconnect);

        // Clear up
        this.tracker = null;
      }
    }

    onInit = (data) => {
      if (this.trackerNode && this.trackerNode.onInit) {
        this.trackerNode.onInit(data);
      }
    }

    onConnect = () => {
      if (this.trackerNode && this.trackerNode.onConnect) {
        this.trackerNode.onConnect(this.tracker);
      }
    }

    onDisconnect = () => {
      if (this.trackerNode && this.trackerNode.onDisconnect) {
        this.trackerNode.onDisconnect(this.tracker);
      }
    }

    registerNode = (node) => {
      this.trackerNode = node;
    }

    renderShocked = (client) => {
      if (!this.tracker) {
        // Create store supporting redux devtool extension
        const store = createStore(
          enhanceReducer(reducer),
          // eslint-disable-next-line no-underscore-dangle, no-undef
          window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
        );
        this.tracker = client.createTracker(trackerId, store);
        if (extend) {
          Object.assign(store.dispatch, extend(this.tracker, this.props));
        } else {
          store.dispatch.createApi = name => this.tracker.createApi(name);
        }

        // Register listeners for connection and disconnection
        this.tracker.on('init', this.onInit);
        client.on('connect', this.onConnect);
        client.on('disconnect', this.onDisconnect);

        this.store = store;
      }

      return (
        <Provider store={this.store}>
          <Target
            ref={this.registerNode}
            {...this.props}
            tracker={this.tracker}
          />
        </Provider>
      );
    }

    render() {
      return (
        <Consumer>
          {this.renderShocked}
        </Consumer>
      );
    }
  };
}

export default track;
