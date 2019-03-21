import createClient, { createApi } from './createClient';
import enhancer from './enhancer';

import {
  setUrl,
  useSession,
  useShocked,
  useConnectionStatus,
  isConnected,
  listenStatus,

  getSession,
  setSession,
} from './Shocked';

export default createClient;
export {
  createClient,
  createApi,

  enhancer,
  setUrl,

  useSession,
  useShocked,
  useConnectionStatus,

  isConnected,
  listenStatus,

  getSession,
  setSession,
};
