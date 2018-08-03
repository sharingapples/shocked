import { start, createScope } from '../src';
import { PROXY_PORT } from './common';

const name = () => 'proxy';

createScope('proxy', () => ({
  name,
}));

const url = '/proxy';

start({ port: PROXY_PORT, url }, () => {
  console.log('Starting proxy session');
  return true;
});

console.log('Started proxy server at port', PROXY_PORT);
