import createRedisProvider from 'shocked-channel-redis';
import { SERVER_PORT } from './common';
import { start } from '../src';

import './api';

const PORT = SERVER_PORT;

const url = '/demo/:id/:name';
const channelProvider = createRedisProvider();

start({ port: PORT, url, channelProvider }, (session) => {
  const user = session.params;
  console.log(`Creating session for ${user.name}/${user.id}`);

  session.set('user', user);
  return true;
});

console.log('Started server at port', PORT);
