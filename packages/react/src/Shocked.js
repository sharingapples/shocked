// @flow
import React, { Component } from 'react';
import { createClient } from 'shocked-client';

type Props = {
  host: string,
  path: string,
  onInit: () => {},
  onConnect: () => {},
  onDisconnect: () => {},
};

const ShockedContext = React.createContext();

class Shocked extends Component<Props> {
  constructor(props) {
    super(props);

    this.client = createClient(props.host);
    this.setPath(props.path);

    const { onConnect, onDisconnect } = props;

    this.client.on('connect', onConnect);
    this.client.on('disconnect', onDisconnect);

    if (props) {
      props.onInit(this.client);
    }
  }

  componentWillReceiveProps(nextProps) {
    const { path, onConnect, onDisconnect } = this.props;

    // Set the path only when it changes
    if (path !== nextProps.path) {
      this.setPath(nextProps.path);
    }

    if (nextProps.onConnect !== onConnect) {
      this.client.off('connect', onConnect);
      this.client.on('connect', nextProps.onConnect);
    }

    if (nextProps.onDisconnect !== onDisconnect) {
      this.client.off('disonnect', onDisconnect);
      this.client.on('disconnect', nextProps.onDisconnect);
    }
  }

  setPath(path) {
    if (path) {
      // Attempt a reconnect if path changes
      this.client.connect(path);
    } else if (this.client.isConnected()) {
      // Close the client if there's no path
      this.client.close();
    }
  }

  render() {
    const {
      host,
      path,
      onConnect,
      onDisconnect,
      ...other
    } = this.props;
    return <ShockedContext.Provider value={this.client} {...other} />;
  }
}

export const { Consumer } = ShockedContext;

export default Shocked;
