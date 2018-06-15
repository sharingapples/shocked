import createNetwork from '../src';

const network = createNetwork();
// DNS Query to some other server
const networkDirect = createNetwork({ servers: ['8.8.8.8'] });

network.on('online', () => {
  console.log('ONLINE');
});

network.on('offline', () => {
  console.log('OFFLINE');
});

process.on('SIGINT', () => {
  console.log('Handle exit');
  network.stop();
  networkDirect.stop();
});

network.on('online', () => {
  console.log('8.8.8.8 ONLINE');
});

network.on('offline', () => {
  console.log('8.8.8.8 OFFLINE');
});
