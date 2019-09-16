import { useState, useEffect } from 'react';
import { ConnectionStatus } from './types';
import { useController } from './Controller';

/**
 * A connection status listener hook which updates the
 * connection status to 3 different states:
 *  0: offline
 *  1: connected
 *  2: connecting
 *
 * You can either listen for change in the status of listen
 * for the specific state by passing in the status value, in
 * which case the hook will then return a `boolean` value.
 *
 * @param status
 */
export default function useShockedStatus(status: ConnectionStatus = ConnectionStatus.connected): ConnectionStatus | boolean {
  const controller = useController();

  const initialState = status === undefined ? controller.status : (controller.status === status);
  const [state, setState] = useState<boolean|ConnectionStatus>(initialState);

  useEffect(() => {
    return controller.listenStatus((newStatus: ConnectionStatus) => {
      if (status === undefined) {
        setState(newStatus);
      } else {
        setState(newStatus === status);
      }
    });
  }, [status]);

  return state;
}
