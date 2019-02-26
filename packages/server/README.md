# shocked
WebSocket and Redux based library for real time application
development.

## Concepts
1. Tracker
2. Session
3. Channel

## Creating application server
### Entry Point
```javascript
const createServer = require('shocked-server');
const server = createServer();

const apis = {
  addItem,
  clearItem,
};

server.track('part/:id/:part', apis,  ({ id, part }, sessionId) => {
  // Validate connection request for the given parameters and sessionId
  // Throw an error if the validation is not successful,
  // This function can be async

  // Return a function that would initialize the session
  // Use this opportunity to associate the session with a channel
  return (session) => {
    const channel = `part-${id}`
    SomeChannel.subscribe(channel, session)(action) => {
      session.dispatch(action);
    });

    session.addCloseListener(() => {
      SomeChannel.unsubscribe(channel, session);
    });

    // Return a method to populate initial data for the session
    // Use context values
    return (context) => ([
      { type: 'populate', payload: [1, 2, 3] },
    ]);
  };
});

server.listen(port);

process.on('exit', () => {
  server.close();
});
```

### Typical apis
```javascript
const addItem = (session) => async (item) => {
  const res = await Item.insert(item);

  // Notify any other channel as required
  // When using pub/sub model, it might not be required to
  // dispatch the action specifically to the session, as the pub/sub
  // mechansim should be handling this

  // Dispatch the response to the session
  session.dispatch(Item.schema.insert(res));
}

const clearItem = (session) => async (id) => {
  const res = await Item.delete(id);
  session.dispatch(Item.schema.delete(id));
}

```
