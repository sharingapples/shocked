import { useState, useEffect, useCallback } from 'react';
import { RemoteApi, Unsubscribe } from 'shocked-types';
import { useController, Controller } from './Controller';
import { ConnectionStatus } from './types';

type Callback = (api: RemoteApi, controller: Controller) => Promise<any>;

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

export function useShockedResponse(call: Callback, args:any[] = []) {
  const [result, setResult] = useState<any>(undefined);
  const controller = useController();

  useEffect(() => {
    let mounted = true;
    let unsub: Unsubscribe | null;

    function exec(status: ConnectionStatus) {
      if (status === ConnectionStatus.connecting) {
        return false;
      }

      if (status === ConnectionStatus.connected || status === ConnectionStatus.offline) {
        const fn: Callback = call as Callback;
        setResult(undefined);
        fn(controller.getApis(), controller).then(
          res => mounted && setResult(res),
          err => mounted && setResult(err)
        );
      }

      // Stop listening as soon as the execution is complete
      if (unsub) {
        unsub();
        unsub = null;
      }

      return true;
    }

    if (exec(controller.status) === false) {
      unsub = controller.listenStatus(exec);
    }

    return () => {
      mounted = false;
      if (unsub) unsub();
    }
  }, args);

  return result;
}

export function useShockedApi() {
  const controller = useController();
  return controller.getApis();
}

export function useShockedCallback(fn: Callback, deps: readonly any[]) {
  const controller = useController();
  return useCallback(() => {
    fn(controller.getApis(), controller);
  }, deps);
};
