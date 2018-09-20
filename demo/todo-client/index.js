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
      console.log('Closing connection');
      this.client.close();
    } else {
      this.setState({ user: this.inp.value }, () => {
        this.client.reconnect();
      });
    }
  }

  render() {
    const host = window.location.hostname;
    const { user, connected } = this.state;
    console.log('Connecting to', user);
    return (
      <Shocked
        host={`ws://${host}:3001`}
        path={`/todo/${user}`}
        onInit={this.onInit}
        onConnect={() => this.setState({ connected: true })}
        onDisconnect={() => this.setState({ connected: false })}
      >
        <input ref={n => {this.inp = n;}} type="text" defaultValue={`${user}`} />
        <button type="button" onClick={this.toggleConnection}>{connected ? 'Disconnect' : 'Connect' }</button>
        <Todo user={user} />
      </Shocked>
    );
  }
}

export default App;
