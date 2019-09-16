type SessionEvents = 'close';
type Listener = () => void;

export interface Session<U> {
  user: U,
  dispatch: Dispatch,
  close: () => void,
  on: (event: SessionEvents, listener: Listener) => void,
  off: (event: SessionEvents, listener: Listener) => void,
};

export type ClientApi = {
  [name: string]: null,
};

export type ServerApi<U> = {
  [name: string]: (payload: any, session: Session<U>) => any,
}

export type RemoteApi = {
  [name: string]: (payload: any) => Promise<any>,
};

export type Dispatch = (action: any) => void;
export type Dispatcher = Dispatch | {
  dispatch: Dispatch
};

export type Unsubscribe = () => void;

export interface Channel {
  readonly name: string,
  subscribe: (id: string, dispatcher: Dispatcher) => Unsubscribe;
  publish: (id: string, message: any) => void;
}
