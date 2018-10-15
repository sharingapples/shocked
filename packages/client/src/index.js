import { TYPE_TRACKER_INIT, TYPE_BATCH_ACTIONS } from 'shocked-common';
import createClient from './createClient';
import enhanceReducer from './enhanceReducer';

export default createClient;
export {
  TYPE_TRACKER_INIT,
  TYPE_BATCH_ACTIONS,

  enhanceReducer,
  createClient,
};
