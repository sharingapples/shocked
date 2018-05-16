# socket.red-client
WebSocket client library for [socket.red](https://npmjs.com/package/socket.red) server. Checkout [socket.red-native](https://npmjs.com/package.socket.red-native)
for react-native implementation. The socket is designed with redux store as a
application state management platform.

One of the main purpose of the library is to keep the connection alive in all
scenarios. The implementation reconnects the client in any case of error.

# Installation
> `$ npm install --save socket.red-client`

# API
## modules
### createSocket(dispatch, options, WebSocket, Network)
The default module to create a socket object.
1. dispatch  
   The redux store dispatch method. This method is invoked remotely. It keeps
   your local redux store in sync with the remote redux store. In case of 
   connection and reconnection, you could keep track of a serial id between
   client and server implementation and on every reconnection dispatch a 
   batch action.
2. options  
   You can provide the following options:  
   **errorRetryInterval** (default 3000): The number of milliseconds to wait
   before reconnecting in case of an error on socket.  
   **responseTimeoutInterval** (default 3000): The number of milliseconds within
   which a response is expected when a rpc call is made.  
   **disconnectConnectDebouce** (default 0): A debounce to avoid getting
   disconnect/connect event pair, in cases when a connect happens immediately
   after disconnect. A value of 0 disables it. You should keep a tad above your
   average latency if you plan on using it. This should be helpful on getting
   rid of unwanted app state changes during disconnection and reconnection.
3. WebSocket  
   A WebSocket implementation on client. It is not required in HTML5 supported
   browsers. You might need a polyfill in other environments
4. Network  
   An object that provides a mechanism to let our library know if there is network
   connection on the device. The library will not try to perform a reconnection 
   in case there isn't any network. The object requires the following methods:  
   **isConnected** return true/false/Promise to provide current status  
   **onConnected** an event listener that calls back whenever there is a
   network connection.  
   **clear** for cleanup

#### open(url:string)
Establish connection to the remote url. 

#### close()
Close the socket (cleanup)

#### freeze()
Closes the connection and doesn't attempt to reconnect

#### unfreeze()
Try to reconnect to the server

#### rpc(name, args: array)
Make a remote api call on server

#### on('connect', () => {})
#### on('disconnect', () => {})
#### on('error', (error) => {})
#### on('event', (name, data) {})


### connectAPI(Class, socket)
Helper method to create an object to make remote api calls via the socket.


# Usage
```javascript
import createSocket, { connectApi } from 'socket.red-client'

// Create a socket connected to a redux store
const options = {};
const socket = createSocket(store.dispatch, options, WebSocket);

// Start a connection with remote server with
// The socket will try to connect with the server, and keep the connection
// up in any condition unless, the socket is forzen (`socket.freeze`) or
// closed (`socket.close`)
socket.open(url);

// Add event handlers to socket
socket.on('connect', () => {
  // Everytime the connection is established to the remote server
  // you could take this oppertunity to let your app know its online
  store.dispatch({ type: 'ONLINE_STATUS', payload: true });
});

socket.on('disconnect', () => {
  // As soon as the client knows the socket has been closed
  store.dispatch({ type: 'ONLINE_STATUS', payload: false });
});

socket.on('error', (e) => {
  // Whenever an error occurs on the socket
  store.dispatch({ type: 'ONLINE_ERROR', payload: e.message });
});

socket.on('event', (name, data) => {
  // Any event that has been emitted by the server is received here
  // You can emit events for stuff that you couldn't dispatch on
  // the store, but I haven't found any use case so far
});

// Make calls to the remote server with arguments
socket.rpc('clap', [21]);

// You could use the connectApi helper method to create an api object
class YourApiClass {
  clap(hands) { }
};

const api = connectApi(YourApiClass, socket);
api.clap(21);

// The rpc calls are promise based, so you could wait for the result or catch
// an error if the rpc call fails for any reason. Keep in mind however that 
// the rpc call might have successfully executed on the server, but the response
// might not have reached the client.
const res = await api.clap(21);

// You could also use the freeze/unfreeze methods to disconnect your socket
// and then reconnect again in the events like your app goes to background
// Check out https://npmjs.com/package/socket.red-native (socket.red-native)
// which uses this mechanism for react-native
socket.freeze(); // Disconnects your socket and doesn't attempt to reconnect
socket.unfreeze(); // Reconnect your socket
```
