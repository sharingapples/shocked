import { WebSocketBehavior, WebSocket, HttpRequest } from 'uWebSockets.js';
import { ServerApi } from 'shocked-types';
import { IDENT, API, API_RESPONSE } from 'shocked-common';
import nanoid from 'nanoid';

import Session from './Session';

export interface TrackerBehaviour<U> {
  api: ServerApi<U>,
  onIdent: (ident: any) => Promise<U>,
  onStart: (session: Session<U>) => Promise<void>,

  createSession?: (tracker: Tracker<U>, user: U, socket: WebSocket) => Promise<Session<U>>,
}

export class Tracker<U> implements WebSocketBehavior {
  private readonly behaviour: TrackerBehaviour<U>;
  private readonly sessions: { [id: string]: Session<U> };

  // Without maxPayloadLength, the connection will be closed abruptly
  maxPayloadLength = 1024 * 1024;

  // Set a idleTimeout at 30 seconds, The client will be disconnected if no data is sent within
  // this period
  idleTimeout = 30;

  constructor(behaviour: TrackerBehaviour<U>) {
    this.behaviour = behaviour;
    this.sessions = {};
  }

  private getSession(ws: WebSocket) {
    const sessionId = ws.sessionId;
    if (!sessionId) return null;
    const session = this.sessions[sessionId];
    return session;
  }

  getApi(name: string) {
    return this.behaviour.api[name];
  }

  // Websocket open event
  open = (ws: WebSocket, req: HttpRequest) => {
    // Start a timer to kill the websocket if not identified
  }

  // Websocket drain event
  drain = (ws: WebSocket) => {
    const session = this.getSession(ws);
    if (session) session.drain(ws);
  }

  // Websocket close event
  close = (ws: WebSocket, code: number) => {
    const sessionId = ws.sessionId;
    const session = this.sessions[sessionId];
    if (session) {
      delete this.sessions[sessionId];
      session.destroy();
    }
  }

  message = async (ws: WebSocket, msg: ArrayBuffer) => {
    try {
      const payload = JSON.parse(Buffer.from(msg).toString());
      const type = payload[0];

      // handle the ident
      if (type === IDENT) {
        // identify the session user
        const user = await this.behaviour.onIdent(payload[1]);

        // Generate a sessino id
        const sessionId = nanoid();
        const session = this.behaviour.createSession
          ? (await this.behaviour.createSession(this, user, ws))
          : new Session(this, user, ws);

        this.sessions[sessionId] = session;
        ws.sessionId = sessionId;

        // Send the identity
        session.send([IDENT, sessionId]);
        return;
      }

      // All other message must be targetted towards a session
      const sessionId = ws.sessionId;
      const session = this.sessions[sessionId];
      if (!session) {
        throw new Error('Session not found');
      }

      if (type === API) {
        const id = payload[1];
        try {
          const result = await session.execute(payload[2], payload[3]);
          ws.send(JSON.stringify([API_RESPONSE, id, false, result]));
        } catch (err) {
          ws.send(JSON.stringify([API_RESPONSE, id, true, err.message]));
        }
      }
    } catch (err) {
      console.error(err);

      // Looks like we got ourselves some problem dealing with the socket
      ws.close();
    }
  }
}
