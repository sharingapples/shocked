# shocked-client
This library provides internal implementation for client
side web socket connection. It is used by `shocked-react`
to provide a seamless integration to connect with server
side api.

You should use `shocked-react` for your react applications.
Use this library as a lower level api.

## Installation
> `$ npm install shocked-client`

or

> `$ yarn add shocked-client`

## Available apis with shocked-client
### `createClient(host, WebSocket)`
Creates a long live client instance available for connecting
to the remove host. The client has the following methods
available:
#### `client.connect(path)`
Establish connection to remote host at the given path

#### `client.isConnected()`
Get current client status

#### `client.close()`
Close a client connection if any

#### `client.send()`
Send raw data to the remote host

#### `client.createTracker(trackerId, store, params)`
Create a tracker to track content on server. The remote tracker
then dispatches action directly to the given store. Provide
initial params for the tracker if any.
  * `tracker.close` - Close the tracker when it's not required any more.
  * `tracker.createApi` - to bind remote api to the client


#### `client.on(event, listener)`
Listen for client events - connect, disconnect.

#### `client.off(event, listener)`
Remove event listener added to clients

