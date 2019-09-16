import { App, TemplatedApp, us_listen_socket_close, HttpRequest, HttpResponse } from 'uWebSockets.js';
import { Tracker, TrackerBehaviour } from './Tracker';
import { Unsubscribe } from 'shocked-types';

function compat(handler: (req: HttpRequest, res: HttpResponse) => void) {
  return (res: HttpResponse, req: HttpRequest) => {
    handler(req, res);
  }
}

class Server<U, P> {
  app: TemplatedApp;

  constructor() {
    this.app = App({

    });
  }

  get(path: string, handler: (req: HttpRequest, res: HttpResponse) => void) {
    return this.app.get(path, compat(handler));
  }

  post(path: string, handler: (req: HttpRequest, res: HttpResponse) => void) {
    return this.app.post(path, compat(handler));
  }

  track(path: string, behaviour: TrackerBehaviour<U, P>) {
    const tracker = new Tracker(behaviour);
    this.app.ws(path, tracker);
    return this;
  }

  async start(port: number): Promise<Unsubscribe> {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (socket) => {
        if (socket) {
          resolve(() => us_listen_socket_close(socket));
        } else {
          reject(new Error(`Could not listen on port ${port}`));
        }
      });
    });
  }
}

export default Server;
