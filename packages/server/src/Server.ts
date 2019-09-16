import { App, TemplatedApp } from 'uWebSockets.js';
import { Tracker, TrackerBehaviour } from './Tracker';

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

  async start(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (socket) => {
        if (socket) {
          resolve(port);
        } else {
          reject(new Error(`Could not listen on port ${port}`));
        }
      });
    });
  }
}

export default Server;
