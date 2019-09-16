import { ClientApi, Unsubscribe } from 'shocked-types';

export type NetworkCallback = (network: boolean) => void;
export type NetworkProvider = (cb: NetworkCallback) => Unsubscribe;

export type ShockedProps = {
  url: string,  // Remote websocket url
  ident: string, // Session identification
  clearIdent: () => {}, // Callback to clear identification. Alias to logout.

  networkProvider?: NetworkProvider,

  dispatch: Dispatch,

  // List of remote apis that need to be supported
  api: ClientApi,
};

export enum ConnectionStatus {
  offline = 0,
  connecting = 1,
  connected = 2,
};

export type Dispatch = (action: any) => void;
