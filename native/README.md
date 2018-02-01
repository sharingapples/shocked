# socket.red-native
A socket.red-client implementation for react-native.

Check out the socket.red-client documentation for proper usage. 

It provides a NetInfo and AppState implementation for handling
network detection and app state changes.

You will need to provide ACCESS_NETWORK_STATE permission in android
for this to work. In your app's `AndroidManifest.xml` add the following:

> `<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />`

# Installation
> `$ npm install socket.red-native`

# Usage
```javascript
import createSocket, { connectApi } from 'socket.red-native';

const socket = createSocket(store.dispatch, {});
const api = connectApi(YourApiClass, socket);
```
