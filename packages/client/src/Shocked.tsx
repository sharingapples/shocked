import React, { useRef, useEffect } from 'react';
import { ClientApi, Unsubscribe } from 'shocked-types';
import { ShockedProps, ConnectionStatus, Dispatch } from './types';
import { Controller, ControllerContext } from './Controller';

type Disconnect = () => void;

function useControllerRef(api: ClientApi, dispatch: Dispatch): Controller {
  const ref = useRef<Controller>();
  if (!ref.current) {
    ref.current = new Controller(api, dispatch);
  }

  return ref.current;
}

export default function Shocked(props: ShockedProps) {
  const {
    url, ident, clearIdent,
    networkProvider,
    api,
    dispatch,
    ...other
  } = props;

  const controller = useControllerRef(api, dispatch);

  useEffect(() => {
    // No need to connect if there isn't any
    if (!ident || !url) return controller.setStatus(ConnectionStatus.offline);

    // The cleanup method
    let disconnect: (Disconnect | null) = null;
    let unsub: Unsubscribe;

    if (typeof networkProvider !== 'function') {
      disconnect = controller.connect(url, ident);
    } else {
      unsub = networkProvider((network) => {
        // Disconnect the previous connection
        if (disconnect) disconnect();
        disconnect = network ? controller.connect(url, ident) : null;
      });
    }

    return () => {
      if (unsub) unsub();
      if (disconnect) disconnect();
    };
  }, [ident, url, networkProvider]);

  return (
    <ControllerContext.Provider value={controller} {...other} />
  );
}
