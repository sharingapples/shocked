import React, { Component } from 'react';
import { createStore } from 'redux';
import { createProvider } from 'react-redux';
import { enhanceReducer } from 'shocked-client';
import { Consumer } from './Shocked';

function track(trackerId, reducerFactory, extend) {
  const Provider = createProvider(trackerId);

  return (Target) => {
    class Tracker extends Component {
      state = {
        online: false,
      };

      componentWillUnmount() {
        if (this.tracker) {
          this.tracker.close();

          // Clear up
          this.tracker = null;
        }
      }

      onOpen = () => {
        this.setState({ online: true });
      }

      onClose = () => {
        this.setState({ online: false });
      }

      renderShocked = (client) => {
        const { online } = this.state;
        const { forwardedRef } = this.props;
        if (!this.tracker) {
          const res = reducerFactory(this.props, { enhanceReducer });
          const store = typeof res !== 'function' ? res : createStore(
            enhanceReducer(res),
            // eslint-disable-next-line no-underscore-dangle, no-undef
            window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
          );

          // eslint-disable-next-line react/destructuring-assignment
          this.tracker = client.createTracker(trackerId, store, this.props.params);
          if (extend) {
            Object.assign(store.dispatch, extend(this.tracker, this.props));
          } else {
            store.dispatch.createApi = name => this.tracker.createApi(name);
          }

          this.tracker.on('open', this.onOpen);
          this.tracker.on('close', this.onClose);

          this.store = store;
        }

        return (
          <Provider store={this.store}>
            <Target
              ref={forwardedRef}
              {...this.props}
              tracker={this.tracker}
              online={online}
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
    }

    return React.forwardRef((props, ref) => <Tracker {...props} forwardedRef={ref} />);
  };
}

export default track;
