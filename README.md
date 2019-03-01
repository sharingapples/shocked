# Shocked
Websocket and redux based client-server synchronization library

## Server
### Define server apis
```javascript
export const addTodo = (session) => (todo) => {
  const res = await db.Todo.insert(todo);


  // Dispatch the action to the client session
  session.dispatch(db.Todo.schema.insert(res));
}

export const clearTodo = (session) => (todo) => {
  const res = await db.Todo.update(todo.id, { done: true });

  session.dispatch(db.Todo.schema.update(res));
}
```

### Create server
```javascript
const createServer = require('shocked-server');
const server = createServer();

server.track('/todo/:uid', ({ uid }, sessionId) => {
  // Validate the session and the parameters here

  return (session) => {
    // Session is initializing, register it with channels as per requirement

    return (context) => {
      // Return an initial set of data for the session here
      return [
        { type: POPULATE, payload: Todos.get(uid) }
      ];
    };
  };
});

// Listen on an http port
server.listen(9090);

// You can add http route handler with the server
// The server router is compatible with expressjs and uses Polka internally
server.get('/', (req, res) => {
  res.end('Welcome to awesome home page');
});

// Make sure the server closes properly
process.on('exit', () => server.close());
```

*NOTE: If you run the server in development mode (NODE_ENV=development), then you can test
the server api on `/debug` path of your server*

### Connect client with redux
```javascript
import { enhancer, setUrl, createApi } from 'shocked';
import { createStore } from 'redux';

const shockedRedux = enhancer('ws://localhost:9090/todo/user');
const store = createStore(reducer, shockedRedux);

// Use setUrl to update the connection url
store.dispatch(setUrl(`ws://localhost:9090/todo/12312`));

// Dispatch api created with the createApi method
const add = createApi('addTodo');
store.dispatch(add({ title: 'Get milk' }));
```
