import { App, TemplatedApp, us_listen_socket_close } from 'uWebSockets.js';
import { Tracker, TrackerBehaviour } from './Tracker';
import { Unsubscribe } from 'shocked-types';

class Server<U> {
  app: TemplatedApp;

  constructor() {
    this.app = App({

    });
  }

  track(path: string, behaviour: TrackerBehaviour<U>) {
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
