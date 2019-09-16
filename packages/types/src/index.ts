export type ClientApi = {
  [name: string]: null,
};

export type ServerApi = {
  [name: string]: (...args: []) => any,
}

export type RemoteApi = {
  [name: string]: (...args: []) => Promise<any>,
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
