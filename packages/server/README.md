# shocked
WebSocket based library for real time application
development.

## Concepts
1. Session
2. Channels
3. Tracker

## Creating application server
### Entry Point
```javascript
const { createServer } = require('shocked');
const server = createServer();
server.serve(new SpecialService(server));

server.start({ port });
```

### The service being served by the server
```javascript
const { Service } = require('shocked');
class SpecialService extends Service {
  constructor(server) {
    // Provide url for the service
    super(server, { url: '/spec/:token'});

    // Initialize your database or stuff

    // register trackers
    this.registerTracker(SpecialTracker);
  }

  // Validate input params, before starting the session
  async onValidate({ params }) {
    const user = await getUserForToken(params.token);

    // Return items that are available on session.get
    return { user };
  }
}

module.exports = SpecialService;
```
### The Tracker
```javascript
const { Tracker } = require('shocked');

class SpecialTracker extends Tracker {
  // Override getData method to retrieve data for the tracker,
  // which is returned as soon as the tracker is connected
  // A params is available which might provide a input parameters
  // for retrieving data
  async getData(params) {
    return initialData;
  }

  // Define your apis as needed for your special tracker
  add(record) {
    // Data is also available on session, you can throw
    // error in case the api is not allowed for any reason
    const { user } = this.session.get('user');
    this.db.add(record);

    // Dispatch actions that are reflected back on all the
    // connected clients
    this.dispatch({ type: 'add_rec', payload: record });
  }

  // Add apis as required by the client
  remove(record) {
    const { user } = this.session.get('user');

    this.db.remove(record);

    this.dispatch({ type: 'remove_rec', payload: record.id });
  }
}

module.exports = SpecialTracker;
```

## Creating react client
### The app (entry point)
```javascript
import { Shocked } from 'shocked-react';

const App = () => (
  <Shocked host="ws://localhost:3001" path="/special/token_from_cookie">
    <SpecialScreen />
  </Shocked>
);
```
### The Tracking Component
```javascript
import { track } from 'shocked-react';

const SpecialScreen = () = (
  <div>
    <SpecialList />
  </div>
);

const reducer = your-special-reducer;
export default track('Special', () => 'special', reducer);
```
### Connecting component with data
```javascript
import { connect } from 'shocked-react';

// listItems is null until the client is connected
const SpecialList = ({ listItems }) => (
  <div>...</div>
);

const mapStateToProps = (items) => ({ listItems: items });
export default connect('Special')(mapStateToProps)(SpecialList);
```
### Execute apis
```javascript
import { connect, createApi } from 'shocked-react';
const SpecialForm = ({ add }) => (
  <form onSubmit={() => add(record)}>
    ...
  </form>
);

const mapApiToProps = ({ createApi }) => ({
  add: createApi('add'),
  remove: createApi('remove'),
});

export default connect('Special')(null, mapApiToProps)(SpecialForm);

```


