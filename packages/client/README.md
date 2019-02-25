# shocked
A websocket library for seamless integration of a server with
redux actions.

## Installation
> `$ npm install shocked`

or

> `$ yarn add shocked`

## Available apis with shocked
### `createClient(host, options)`
Create a websocket client that auto reconnects in case of
disconnection. The client supports `api` and `event` as special
messages.

* `host`: The remote endpoint, ex: ws://example.com:8080/123 or wss://example.com:8443 or http://example.com/4534 or https://example.com/212

* `options`
    * netStatus: A net status checker like NetInfo for react-native
    * WebSocket: WebSocket library (not required in most cases)
    * apiTimeout: The number of milliseconds after with the api call
                  is timedout when no response is available. (default: 1000)
    * timeout: The reconnection timeout (default: 1000)
    * maxAttempts: The number of connection attempts after which
                   the client doesn't try to connect again

## Client methods
* `setEndPoint(url)`: Change the remote endpoint, disconnecting the existing connection and establishing a new remote end point
* `execute(api, payload)`: Remote execute the api on the server
* `close()`: Close the client connection. The client instance is
             not usable once this method is invoked.

* `isConnected()`: Get current connection status (boolean).

## Client standard events
* `open`: Socket is connected to the client.
* `close`: Socket is closed.
* `rejected`: Server rejected the connection.
* `maximum`: The number of maximum reconnection attempts failed.

## Redux Enhancer
```javascript
import { enhancer, getConnectivity, setUrl } from 'shocked';

const shockedRedux = enhancer(url, options);

const store = createStore(reducer, shockedRedux);
// with multiple enhancers
const store = createStore(reducer, compose(shockedRedux, applyMiddleware()));

// get the connectivity status from redux state
const conn = getConnectivity(store.getState());

// Update the remote endpoint
store.dispatch(setUrl('ws://localhost:3000/83738'));

// execute apis
const add = createApi('add');
const strike = createApi('strike');

// Dispatch the add method
store.dispatch(add([1, 2]));

// You could event wait for the api response
const res = await store.dispatch(strike({ user, count: 5 }));
```
