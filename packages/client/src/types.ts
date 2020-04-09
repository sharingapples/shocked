import { ClientApi, Unsubscribe } from 'shocked-types';

export type NetworkCallback = (network: boolean) => void;
export type NetworkProvider = (cb: NetworkCallback) => Unsubscribe;

export type ClearIdent = (reason?: string) => void;

export type ShockedProps<I=string> = {
  url: string,  // Remote websocket url
  ident: (() => I) | I, // Session identification
  clearIdent: ClearIdent, // Callback to clear identification. Alias to logout.

  networkProvider?: NetworkProvider,

  dispatch: Dispatch,

  // List of remote apis that need to be supported
  api: ClientApi,
  children: React.ReactElement,
};

export enum ConnectionStatus {
  offline = 0,
  connected = 1,
  connecting = 2,
};

export type Dispatch = (action: any) => void;
