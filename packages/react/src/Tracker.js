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
        this.tracker = null;
      }
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

        this.store = store;
      }

      return (
        <Provider store={this.store}>
          <Target {...this.props} />
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
