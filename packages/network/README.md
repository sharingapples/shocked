# Network detector for Node
Uses DNS resolution query to detect if a network is online or not.

## Installation
> `yarn add shocked-network-node`


## Usage
```javascript
import createNetwork from 'shocked-network-node'

const config = {
  domain: 'The domain that is resolved', // default is google.com, you might want to use your application specific server here
  poll: number, // default is 5000, the interval in number of milliseconds you want to perform the resolution after the last response
                // It doesn't poll exactly in this many milliseconds, but queues the request once the resolution has completed
                // either successfully or with error
  timeout: number, // default is 3000, the interval in number of milliseconds within which dns resolution must respond before
                   // declaring the network as offline
                   // The maximum time it takes to detect the network is offline is (poll + timeout),
  servers: ['ip1', 'ip2'], // default provided by system. The name server ip addresses you would like to use to resolve
};

// config is optional
const network = createNetwork(config);

network.on('online', () => {
  // You are online now
});

network.on('offline', () => {
  // You are offline now
});
```