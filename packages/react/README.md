# shocked-react
React bindings for connecting with server application
developed with `shocked` library.

## Installation
> `$ yarn add shocked-react`

or

> `$ npm install shocked-react`

## Components
### `Shocked`
A top level component that would establish connection with
the remote server.

**Props**
* `host` - Remote host (ws://localhost:3001, wss://example.com)
* `path` - The remote path to connect to. A connection is
           established only after path has been set, and a
           connection is always reset when the path is changed.

### `track`
Create a Component that track data on remote server. A track
creates a redux store with data as structured via the similarly
named Tracker on the server.

`track(trackerName, reducer)(Component)`

### `connect`
Connects a Component with the redux store created with track.

`connect(trackerName)(mapStateToProps, mapApiToProps)(Component)`


