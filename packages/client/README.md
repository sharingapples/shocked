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
import connect from 'shocked-client'

// Create a socket connected to a redux store
const options = {};
const client = connect('ws://host/params', store);

async function main() {
  const demo = await client.scope('demo');

  // Perform a remote call
  await demo.clap(3);
}

```
