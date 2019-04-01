## Shocked Client

### Properties:

1. **Connection Props**
  Starts a new connection (when any one changes). No connection is made when either of them is falsy.
   * `url: null | string`
     Remote endpoint (Ex: http://example.com/your-app/params)
   * `ident: null | {}`
     User identification token. Ex: `{ type: 'fb', token: 'asdfsfkljsdfjasldf' }`
   * `network: boolean`
     Network online status
   * `clearIdent: () => void`
     A callback invoked when the server doesn't identify the `ident` value sent over for identification

 2. **Communication Props**

   * `api: { [string]: API }`
     API structure available for execution on the shocked instance.
   * `context: any`
     Client context to match with server

3. **Synchronization Props**

   * `dispatch: (state, action) => void`
     The dispatch method to synchronize server state with client. This should be the `dispatch` method of your [redux](redux.js.org) or redux compatible stores.

   * `sync: () => Promise<void>`
     A synchronization function that is invoked as soon as the connection goes online. Use this opportunity to synchronize all offline data with the server

4. **Configuration Props**

   * `retryInterval: number` default: 1000
     Number of milliseconds before which reconnection attempts are not made. Reconnection attempts are made whenever the connection is terminated, unless the connection has been rejected by the server (4001).

### Example
```jsx
function offlineSynchronizer() {

}

async function sync() {
  // First Commit and then perform other synchronizations

	// Extract synchronization records
  const toSync = db.getRecords();
}

export default function YourApp() {
  // Use simple helpers to get network status
  const network = useNetStatus();

  // Use authentication library to extract the session information
  const { token, logout } = useAuth();

  // Extract parameters from session
  const user =
  const sessionId = session && session.id;
  const url = session && `ws://example.com/your-app/${session.params}`;

  // If there isn't any session available, may be show a Login screen
  const body = session ? <Home /> : <Login />;

  return (
    <Shocked
      url={url}
      network={network}
      ident={token}
      clearIdent={logout}

      context={currentLodgeId}
      dispatch={store.dispatch}

      sync={sync}
    >
      {body}
    </Shocked>
  );
}

```

## Shocked Server

```jsx
const createServer = require('shocked');

const server = createServer({ pulseRate: 0 });
server.track('/your-app', (tracker) => {
  tracker.onIdent(fb);
  tracker.onIdent(google);
  tracker.onStart((session) => {
    session.subscribe(UserChannel, session.user.id);
  });
  tracker.onContext((context) => {
    session.dispatch({ type: POPULATE, payload: records });
  });
});
```

## Shocked Client API

```javascript
// Without offline support
export const serverOnlyApi = null;

// With offline support
export const createAsset = ((online) => {
  // Add callbacks to run during sync phase of the shocked client
  const sync = createSync('CREATE_ASSET', ({id}) => {
    const rec = await offlineDB.findOne(id);
    return online.createAsset(rec);
  });

  // Return the function to run when offline
  return (payload) => {
    const id = await offlineDB.insert('ASSET', payload);
    await sync({ id });
  }
});
```

