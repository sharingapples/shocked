import { start } from 'redsock';
import createRedisProvider from 'redsock-channel-redis';

import { PORT } from '../common';


import './api';

const url = '/demo/:id/:name';
const channelProvider = createRedisProvider();

start({ port: PORT, url, channelProvider }, (session) => {
  const user = session.params;
  console.log(`Creating session for ${user.name}/${user.id}`);

  session.set('user', user);
});
