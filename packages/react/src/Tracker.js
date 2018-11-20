/* global __DEV__ */
// @flow
import React, { Component } from 'react';
import { createProvider } from 'react-redux';
import { enhanceReducer } from 'shocked-client';
import { ShockedContext } from './Shocked';

type Props = {
  name: string,
  params: {},
  apiProvider: (tracker: {}) => {},
  store: {} | () => {},
  onInit: (tracker: {}) => void,
}

class Tracker extends Component<Props> {
  static contextType = ShockedContext;

  constructor(props, context) {
    super(props, context);

    const {
      name, apiProvider, params, store, onInit,
    } = props;
    const client = context;
    const trackerStore = typeof store === 'function' ? store(enhanceReducer) : store;

    const tracker = client.createTracker(name, trackerStore, params);

    // Expose the createApi method via dispatch
    trackerStore.dispatch.createApi = tracker.createApi.bind(tracker);

    const api = apiProvider(tracker);
    if (typeof api !== 'object') {
      throw new Error('The tracker api must be an object with key as api name and value as api function call');
    }

    // Decorate the dispatch method with the api calls
    Object.assign(trackerStore.dispatch, api);

    if (onInit) {
      onInit(tracker, trackerStore);
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
          // eslint-disable-next-line no-console
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
