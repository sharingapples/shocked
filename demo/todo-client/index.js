import React, { Component } from 'react';
import { Shocked } from 'shocked-react';
import Todo from './Todo';

class App extends Component {
  constructor(props) {
    super(props);

    this.onInit = this.onInit.bind(this);
    this.toggleConnection = this.toggleConnection.bind(this);

    this.state = {
      user: 1,
      connected: false,
    };
  }

  onInit(client) {
    this.client = client;
  }

  toggleConnection() {
    const { connected } = this.state;
    if (connected) {
      this.client.close();
    } else {
      this.client.reconnect();
    }
  }

  render() {
    const { user, connected } = this.state;

    return (
      <Shocked
        host="ws://192.168.2.24:3001"
        path={`/todo/${user}`}
        onInit={this.onInit}
        onConnect={() => this.setState({ connected: true })}
        onDisconnect={() => this.setState({ connected: false })}
      >
        <button type="button" onClick={this.toggleConnection}>{connected ? 'Disconnect' : 'Connect' }</button>
        <Todo user={user} />
      </Shocked>
    );
  }
}

export default App;
