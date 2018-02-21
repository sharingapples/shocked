// The regenerator-runtime needs to be included for the async/await to work
import 'regenerator-runtime/runtime';

import createSocket from './Socket';
import connectApi from './connectApi';
import XHRValidator from './XHRValidator';
import ValidationError from './ValidationError';

export {
  connectApi,
  XHRValidator,
  ValidationError,
};

export default createSocket;
