import { createContext, useContext } from 'react';
import { IDENT, API, API_RESPONSE, DISPATCH, CLEAR_IDENT, EVENT } from 'shocked-common';
import { RemoteApi, ClientApi } from 'shocked-types';
import fixUrl from './fixUrl';
import { ConnectionStatus, Dispatch, ClearIdent } from './types';
import RemoteError from './RemoteError';

// @ts-ignore
export const ControllerContext = createContext<Controller>(null);

type SetStatus = (status: ConnectionStatus) => void;
type Resolve = (value?: unknown) => void;
type Reject = (reason?: Error) => void;

export function useController(): Controller {
  return useContext(ControllerContext);
}

export type EventHandler<T = any> = (payload: T) => void;

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
  private clearIdent: ClearIdent;

  private eventHandlers: {[eventName: string]: Array<EventHandler>} = {};

  private get retryInterval() {
    // Return a random interval between 1 and 5 seconds
    const interval = Math.floor(Math.random() * 4000) + 1000;
    const prev = Date.now() - this.attemptedAt;
    if (prev > interval) return 0;
    return interval - prev;
  }

  constructor(api: ClientApi, dispatch: Dispatch, clearIdent: ClearIdent) {
    this.dispatch = dispatch;
    this.clearIdent = clearIdent;

    // Bind the api with the connection
    this.apis = Object.keys(api).reduce((res, name) => {
      res[name] = (payload: any) => {
        if (this.send === null) {
          // See if there is an offline call available, then do that
          const offlineCall = api[name];
          if (typeof offlineCall === 'function') {
            // @ts-ignore
            return Promise.resolve(offlineCall(payload));
          }

          return Promise.reject(new Error('No connection and no offline fallback'));
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

  connect(url: string, getIdent: any | (() => any)) {
    let ws: WebSocket;
    let retryTimer: null | ReturnType<typeof setTimeout> = null;
    let cleaned = false;

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
        ws.send(JSON.stringify([IDENT, typeof getIdent === 'function' ? getIdent() : getIdent]));
      }

      ws.onclose = (evt) => {
        if (cleaned) return;
        this.setStatus(ConnectionStatus.offline);
        cleanup();
        // Unless the close was deliberate from the server
        // Perform a reconnection attempt
        if (evt.code === CLEAR_IDENT) {
          // Fire the close event
          this.clearIdent(evt.reason);
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
          if (res[1].type === 'event') {
            this.fireEvent(res[1].name, res[1].payload);
          } else {
            this.dispatch(res[1]);
          }
        } else if (type === EVENT) {
          this.fireEvent(res[1], res[2]);
        }
      }
    }

    // Setup first connection attempt
    connection();

    return () => {
      cleaned = true;
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
    for (let i = this.statusListeners.length - 1; i >= 0; i--) {
      this.statusListeners[i](status);
    }
  }

  setStatus(status: ConnectionStatus) {
    // TODO: Defer status changes to implement debounce
    if (this.status === status) return;
    this.status = status;
    this.fireStatus(status);
  }

  addEventListener(eventName: string, handler: EventHandler) {
    let handlers = this.eventHandlers[eventName];
    if (!handlers) {
      handlers = [];
      this.eventHandlers[eventName] = handlers;
    }

    handlers.push(handler);
  }

  removeEventListener(eventName: string, handler: EventHandler) {
    let handlers = this.eventHandlers[eventName];
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx >= 0) {
      if (handlers.length === 1) {
        delete this.eventHandlers[eventName];
      } else {
        // Replace the handlers with a new instance, in case the handler is being
        // removed due to an event itself
        handlers = handlers.slice();
        handlers.splice(idx, 1);
        this.eventHandlers[eventName] = handlers;
      }
    }
  }

  fireEvent(eventName: string, payload: any) {
    const handlers = this.eventHandlers[eventName];
    if (!handlers) return;
    for (let i = 0; i < handlers.length; i += 1) {
      handlers[i](payload);
    }
  }
}

