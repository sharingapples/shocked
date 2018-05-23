import { start } from 'redsock';
import { PORT } from '../common';
import './api';

start({ port: PORT, url: '/demo/:id/:name' }, (session) => {
  const user = session.params;
  console.log(`Creating session for ${user.name}/${user.id}`);

  session.set('user', user);
});
