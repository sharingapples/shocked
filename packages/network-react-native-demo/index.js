/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

// eslint-disable-next-line
import React, { Component } from 'react';
// eslint-disable-next-line
import { Platform, StyleSheet, Text, View } from 'react-native';
import createNetwork from 'shocked-network-react-native';
import { render } from 'rn-app';

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' +
    'Cmd+D or shake for dev menu',
  android: 'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});


type Props = {};
export default class App extends Component<Props> {
  constructor(props) {
    super(props);

    const network = createNetwork();
    network.on('online', () => {
      console.log('Event online');
      this.setState({ online: true });
    });
    network.on('offline', () => {
      console.log('Event offline');
      this.setState({ online: false });
    });
  }

  state = {
    online: false,
  };

  render() {
    const { online } = this.state;

    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.js
        </Text>
        <Text style={styles.instructions}>
          {instructions}
        </Text>
      </View>
    );
  }
}

render(<App />);
