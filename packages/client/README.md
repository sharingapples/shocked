# shocked-client
WebSocket client library for [shocked](https://npmjs.com/package/shocked) server. 
The socket is designed with redux store as a application state management platform.

The client is built with reconnect support.

# Installation
> `$ npm install --save shocked-client`

# API
### connect(url, store)


# Usage
```javascript
import { createClient } from 'shocked-client'

// Create a socket connected to a redux store
const options = {};
const client = createClient('ws://host', store);
client.connect('/params');

async function main() {
  const demo = await client.scope('demo');

  // Perform a remote call
  await demo.clap(3);
}

```

## Use optional (recommended) network state listener for automatic reconnections

```javascript
import { createClient } from 'shocked-client';
import createNetwork from 'shocked-network-node';
// import createNetwork from 'shocked-network-browser';
// import createNetwork from 'shocked-network-react-native';

const options = {};
const client = createClient(
  'ws://host', 
  store, 
  global.WebSocket, // Provide the WebSocket class
  createNetwork()   // Create network to listen for online/offline status
);

client.connect('/params');
