// @flow
import React, { Component } from 'react';
import { createClient } from 'shocked-client';

type Props = {
  host: string,
  path: string,
  onInit: (client: {}) => {},
  onConnect: () => {},
  onDisconnect: () => {},
  children: any,
};

export const ShockedContext = React.createContext();

class Shocked extends Component<Props> {
  constructor(props) {
    super(props);

    this.client = createClient(props.host);
    this.setPath(props.path);

    const { onConnect, onDisconnect } = props;

    this.client.on('connect', onConnect);
    this.client.on('disconnect', onDisconnect);

    if (props.onInit) {
      props.onInit(this.client);
    }
  }

  componentDidUpdate(prevProps) {
    const {
      path, host, onConnect, onDisconnect,
    } = this.props;
    if (prevProps.host !== host) {
      throw new Error('The host property for Shocked component should not be changed');
    }

    if (path !== prevProps.path) {
      this.setPath(path);
    }

    if (onConnect !== prevProps.onConnect) {
      this.client.off('connect', prevProps.onConnect);
      this.client.on('connect', onConnect);
    }

    if (onDisconnect !== prevProps.onDisconnect) {
      this.client.off('disconnect', prevProps.onDisconnect);
      this.client.on('disconnect', onDisconnect);
    }
  }

  componentWillUnmount() {
    this.client.close();
  }

  setPath(path) {
    if (path) {
      // Attempt a reconnect if path changes
      this.client.connect(path);
    } else {
      this.client.clearPath();
    }
  }

  render() {
    const { children } = this.props;

    // eslint-disable-next-line react/no-children-prop
    return <ShockedContext.Provider value={this.client} children={children} />;
  }
}

export default Shocked;
