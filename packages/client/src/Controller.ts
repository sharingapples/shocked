import { createContext, useContext } from 'react';
import { IDENT, API, API_RESPONSE, DISPATCH } from 'shocked-common';
import { RemoteApi, ClientApi } from 'shocked-types';
import fixUrl from './fixUrl';
import { ConnectionStatus, Dispatch } from './types';
import RemoteError from './RemoteError';

// @ts-ignore
export const ControllerContext = createContext<Controller>(null);

type SetStatus = (status: ConnectionStatus) => void;
type Resolve = (value?: unknown) => void;
type Reject = (reason?: Error) => void;

export function useController(): Controller {
  return useContext(ControllerContext);
}

export class Controller {
  status: ConnectionStatus = ConnectionStatus.connecting;
  statusListeners: Array<SetStatus> = [];
  apis: RemoteApi;
  activeApis: {
    [id: string]: [Resolve, Reject],
  } = {};
  callId: number = 0;
  private send: null | ((payload: any) => void) = null;
  private attemptedAt: number = 0;
  private dispatch: Dispatch;

  private get retryInterval() {
    // Return a random interval between 1 and 5 seconds
    const interval = Math.floor(Math.random() * 4000) + 1000;
    const prev = Date.now() - this.attemptedAt;
    if (prev > interval) return 0;
    return interval - prev;
  }

  constructor(api: ClientApi, dispatch: Dispatch) {
    this.dispatch = dispatch;

    // Bind the api with the connection
    this.apis = Object.keys(api).reduce((res, name) => {
      res[name] = (payload: any) => {
        if (this.send === null) {
          throw new Error('No connection');
        }

        this.callId += 1;
        const id = this.callId;

        // Send the api
        this.send([API, id, name, payload]);
        return new Promise((resolve, reject) => {
          this.activeApis[id] = [resolve, reject];
        });
      };
      return res;
    }, {} as RemoteApi);
  }

  connect(url: string, ident: string) {
    let ws: WebSocket;
    let retryTimer: null | ReturnType<typeof setTimeout> = null;

    function clearRetry() {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    const cleanup = () => {
      clearRetry();
      // close all api calls
      Object.keys(this.activeApis).forEach((key) => {
        this.activeApis[key][1](new Error('Server has gone away'));
      });
    }

    const connection = () => {
      this.setStatus(ConnectionStatus.connecting);
      this.attemptedAt = Date.now();
      this.send = null;

      ws = new WebSocket(fixUrl(url));

      ws.onopen = () => {
        clearRetry();
        ws.send(JSON.stringify([IDENT, ident]));
      }

      ws.onclose = (evt) => {
        this.setStatus(ConnectionStatus.offline);
        cleanup();
        // Unless the close was deliberate from the server
        // Perform a reconnection attempt
        if (evt.code === 4000) {
          // Fire the close event
        } else {
          // Setup a retry
          retryTimer = setTimeout(connection, this.retryInterval);
        }
      }

      ws.onmessage = (evt) => {
        const res = JSON.parse(evt.data);
        const type = res[0];
        if (type === IDENT) {
          this.send = (obj: any) => {
            ws.send(JSON.stringify(obj));
          };
          this.setStatus(ConnectionStatus.connected);
        } else if (type === API_RESPONSE) {
          const id = res[1] as string;
          const activeApi = this.activeApis[id];
          if (!activeApi) {
            console.warn(`Got response for unkown api ${id}`);
            return;
          }

          const error = res[2] as boolean;
          const result = res[3];
          if (error) {
            activeApi[1](new RemoteError(result));
          } else {
            activeApi[0](result);
          }
        } else if (type === DISPATCH) {
          this.dispatch(res[1]);
        }
      }
    }

    // Setup first connection attempt
    connection();

    return () => {
      clearRetry();
      this.send = null;
      this.setStatus(ConnectionStatus.offline);
      if (ws) ws.close();
    }
  }

  getApis() {
    return this.apis;
  }

  listenStatus(cb: SetStatus) {
    this.statusListeners.push(cb);
    cb(this.status);
    return () => {
      const idx = this.statusListeners.indexOf(cb);
      if (idx >= 0) {
        this.statusListeners.splice(idx, 1);
      }
    };
  }

  fireStatus(status: ConnectionStatus) {
    this.statusListeners.forEach(setStatus => setStatus(status));
  }

  setStatus(status: ConnectionStatus) {
    // TODO: Defer status changes to implement debounce
    if (this.status === status) return;
    this.status = status;
    this.fireStatus(status);
  }
}

