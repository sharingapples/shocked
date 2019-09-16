import { EventEmitter } from 'events';
import { WebSocket } from 'uWebSockets.js';
import { API, API_RESPONSE, DISPATCH, CLEAR_IDENT } from 'shocked-common';
import { Session as SessionInterface } from 'shocked-types';
import { Tracker } from './Tracker';

export default class Session<U, P> extends EventEmitter implements SessionInterface<U, P> {
  readonly user: U;
  readonly params: P;
  private readonly tracker: Tracker<U, P>;
  private socket: WebSocket | null;
  private readonly messageQueue: string[];

  constructor(tracker: Tracker<U, P>, user: U, socket: WebSocket) {
    super();
    this.user = user;
    this.tracker = tracker;
    this.socket = socket;
    this.messageQueue = [];
    this.params = socket.params;
  }

  close(clearIdent?: boolean) {
    if (!this.socket) return;
    // Close the socket on the next free cycle. This allows
    // apis to send their responses
    setTimeout(() => {
      if (this.socket) {
        if (clearIdent) {
          this.socket.end(CLEAR_IDENT);
        } else {
          this.socket.close();
        }
      }
    });
  }

  drain(socket: WebSocket) {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift() as string;
      if (!socket.send(message)) {
        this.messageQueue.unshift();
        return;
      }
    }
  }

  // Session cleanup method called by the tracker
  destroy() {
    // The session is not usable after this
    this.socket = null;
    this.emit('close');

    // Remove all the listeners
    this.removeAllListeners('close');
  }

  send(payload: any) {
    if (!this.socket) return;

    const message = JSON.stringify(payload);
    // If we already have a queue, just queue it
    if (this.messageQueue.length) {
      this.messageQueue.push(message);
    } else {
      // Try to send it, failing with keep it on the queue
      // this could happen when the socket buffer is not available
      // at the moment, the drain event will give an oppertunity to
      // clean it up
      const ok = this.socket.send(message);
      if (!ok) this.messageQueue.push(message);
    }
  }

  async parse(payload: any[]) {
    const type = payload[0];
    if (type === API) {
      const id = payload[1];
      try {
        const result = await this.execute(payload[2], payload[3]);
        this.send([API_RESPONSE, id, false, result]);
      } catch (err) {
        this.send([API_RESPONSE, id, true, err]);
      } finally {
        return;
      }
    }

    throw new Error(`Unknown payload type ${type}`);
  }

  async execute(name: string, args: any) {
    const api = this.tracker.getApi(name);
    if (!api) {
      throw new Error(`Unknown API ${name}`);
    }

    return api(args, this);
  }

  // The dispatch method may be called even when there is no connection
  dispatch(action: any) {
    this.send([DISPATCH, action]);
  }
}
