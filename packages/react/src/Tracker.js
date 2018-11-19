/* global __DEV__ */
// @flow
import React, { Component } from 'react';
import { createProvider } from 'react-redux';
import { enhanceReducer } from 'shocked-client';
import { ShockedContext } from './Shocked';

type Props = {
  name: string,
  params: {},
  store: {} | () => {},
  onInit: (tracker: {}) => void,
}

class Tracker extends Component<Props> {
  static contextType = ShockedContext;

  constructor(props, context) {
    super(props, context);

    const {
      name, params, store, onInit,
    } = props;
    console.log('Context is', context, new Error().stack);
    const client = context;
    const trackerStore = typeof store === 'function' ? store(enhanceReducer) : store;

    const tracker = client.createTracker(name, trackerStore, params);

    // Expose the createApi method via dispatch
    trackerStore.dispatch.createApi = tracker.createApi.bind(tracker);

    if (onInit) {
      onInit(tracker);
    }

    this.state = {
      tracker,
      store: trackerStore,
      Provider: createProvider(name),
    };
  }

  componentDidUpdate(prevProps) {
    if (__DEV__) {
      ['name', 'params', 'store', 'onInit'].forEach((prop) => {
        // eslint-disable-next-line react/destructuring-assignment
        if (this.props[prop] !== prevProps[prop]) {
          console.warn(`The prop ${prop} has changed on the Tracker component which is not supported at the moment. Make sure you don't you anonymous function call as callback parameter in the tracker`);
        }
      });
    }
  }

  componentWillUnmount() {
    const { tracker } = this.state;
    tracker.close();
  }

  render() {
    const { name, params, ...other } = this.props;
    const { Provider, store } = this.state;

    return (
      <Provider store={store} {...other} />
    );
  }
}

export default Tracker;
