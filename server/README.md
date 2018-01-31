# socket.red
A websocket server for executing your apis, dispatching redux actions on clients
and emitting events from server.

# Installation
> `$ npm install --save socket.red`

# Usage
```javascript
const startServer = require('socket.red');

// Your api provider
class ServerApi {
  constructor(session) {
    this.session = session;
  }

  // A simple api that returns a value, error or promise
  clap(numberOfHands) {
    // the api can throw error, which is received at the remote end
    if (!numberOfHands) {
      throw new Error('Cannot clap without any hands');
    }

    // The api can return via promise
    if (numberOfHands > 2) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (numberOfHands > 10) {
            reject(new Error('What kind of a monster are you?'));
          } else {
            resolve('its difficult to clap with so many hands');
          }
        }, 500)
      });
    }

    // The api can return immediately as well
    return `Clap Clap Clap with ${numberOfHands}`;
  }

  // A more useful api that can dispatch action to all the clients
  createRecord(schema, record) {
    const rec = db.insert(schema, record);
    Object.keys(allSessions).forEach(key => allSessions[key].dispatch({
      type: 'schema.insert', 
      schema: model, 
      payload: rec,
    }));
  }
}

const allSessions = {};

// This is how you start the server
startServer(8080, function createSession(url) {
  // You can throw an error here, to reject the connection
  const user = identify(url);

  const session = {
    onClose: () => {
      // Cleanup stuff to do when the remote connection closes
      delete allSessions[user.id];
    },
    api: new ServerApi(session), // Provide the api
    onStart: () => {
      // Store the session for using later
      allSessions[user.id] = session;
      // An entry point for the session startup, you can use the session
      // object here iwth dispatch and emit methods
      session.emit('hi', 'A new session has started'); // Send an event to the client
      session.dispatch({ type: 'ACTION_TYPE', payload: 'Your action data' });
    },

    // Add any other properties to the session as you need
    user,
  };

  return session;
});
```