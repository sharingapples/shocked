import React, { Component } from 'react';
import { createStore } from 'redux';
import { createProvider } from 'react-redux';
import { enhanceReducer } from 'shocked-client';
import { Consumer } from './Shocked';

function track(trackerId, channel, reducer) {
  const Provider = createProvider(trackerId);

  const getChannelId = typeof channel === 'function'
    ? channel
    : () => channel;

  return Target => class Tracker extends Component {
    constructor(props) {
      super(props);

      this.state = { channelId: null };
    }

    shouldComponentUpdate(nextProps, nextState) {
      const { channelId } = this.state;
      return (nextState.channelId !== channelId);
    }

    componentWillUnmount() {
      if (this.tracker) {
        this.tracker.close();
        this.tracker = null;
      }
    }

    static getDerivedStateFromProps(props) {
      return {
        channelId: getChannelId(props),
      };
    }

    renderShocked = (client) => {
      const { channelId } = this.state;

      if (this.tracker && this.tracker.channel !== channelId) {
        this.tracker.close();
        this.tracker = null;
      }

      if (!this.tracker) {
        // Create store supporting redux devtool extension
        const store = createStore(
          enhanceReducer(reducer),
          // eslint-disable-next-line no-underscore-dangle, no-undef
          window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
        );
        this.tracker = client.createTracker(trackerId, channelId, store);
        store.dispatch.createApi = name => this.tracker.createApi(name);

        this.store = store;
      }

      return (
        <Provider store={this.store}>
          <Target />
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
