import { shocked, createScope } from '../src';
import { PROXY_PORT } from './common';

const name = () => 'proxy';

createScope('proxy', () => ({
  name,
}));

const url = '/proxy';

shocked({ port: PROXY_PORT }).handle(url, () => {
  console.log('Starting proxy session');
  return true;
});

