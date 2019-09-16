import { useState, useEffect } from 'react';
import { RemoteApi, Unsubscribe } from 'shocked-types';
import { useController } from './Controller';
import { ConnectionStatus } from './types';

type Callback = (api: RemoteApi) => Promise<any>;

// TODO: Return special Error object that allows retry

/**
 * React safe way of calling remote api. If no arguments are
 * passed, the entire api is returned.
 *
 * if the connection is on a connecting state, the execution
 * takes place only after the connection is established. If
 * the connection is offline, then an error is returned.
 *
 * @param call
 * @param args
 */

export default function useShockedApi(call?: Callback, args:any[] = []) {
  const [result, setResult] = useState<any>(undefined);
  const controller = useController();

  useEffect(() => {
    if (!call) return;

    let handleResult: null | typeof setResult = setResult;
    let handleError: null | typeof setResult = setResult;
    let unsub: Unsubscribe | null;

    function exec(status: ConnectionStatus) {
      if (status === ConnectionStatus.connecting) {
        return false;
      }

      if (status === ConnectionStatus.connected) {
        const fn: Callback = call as Callback;
        fn(controller.getApis()).then(handleResult, handleError);
      } else if (status === ConnectionStatus.offline) {
        setResult(new Error('No connection'));
      }

      // Stop listening as soon as the execution is complete
      if (unsub) {
        unsub();
        unsub = null;
      }

      return true;
    }

    if (exec(controller.status)) {
      unsub = controller.listenStatus(exec);
    }

    return () => {
      handleResult = null;
      handleError = null;
      if (unsub) unsub();
    }
  }, args);

  return result;
}
