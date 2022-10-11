import { WebSocketBehavior, WebSocket, HttpRequest, HttpResponse, us_socket_context_t } from 'uWebSockets.js';
import { ServerApi } from 'shocked-types';
import { IDENT, API, API_RESPONSE, CLEAR_IDENT } from 'shocked-common';
import nanoid = require('nanoid');

import Session from './Session';

export interface TrackerBehaviour<U, P> {
  api: ServerApi<U, P>,
  onIdent: (ident: any, params: P) => Promise<U>,
  onStart: (session: Session<U, P>) => Promise<void>,
  preprocess?: (req: HttpRequest) => P,
}

export class Tracker<U, P> implements WebSocketBehavior {
  private readonly behaviour: TrackerBehaviour<U, P>;
  private readonly sessions: { [id: string]: Session<U, P> };

  // Without maxPayloadLength, the connection will be closed abruptly
  maxPayloadLength = 1024 * 1024;

  // Set an idle timeout of 10 minutes by default. Override this value in the tracker
  idleTimeout = 10 * 60;

  constructor(behaviour: TrackerBehaviour<U, P>) {
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

  upgrade = (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
    console.log('Got upgrade request');
    if (this.behaviour.preprocess) {
      this.behaviour.preprocess(req);
    }

    res.upgrade({
        params: this.behaviour.preprocess ? this.behaviour.preprocess(req) : null,
      }, 
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    );
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
        let user: U;
        try {
          // identify the session user
          user = await this.behaviour.onIdent(payload[1], ws.params);
        } catch (err) {
          // Send a 'clearIdent' error
          ws.end(CLEAR_IDENT, err.message);
          return;
        }

        // Generate a sessino id
        const sessionId = nanoid();
        const session = new Session(this, user, ws);

        this.sessions[sessionId] = session;
        ws.sessionId = sessionId;

        // Send the identity
        session.send([IDENT, sessionId]);

        // Initialize the session
        try {
          await this.behaviour.onStart(session);
        } catch (err) {
          ws.close();
        }

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
