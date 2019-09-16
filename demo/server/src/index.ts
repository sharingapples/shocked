import { Server, Session } from 'shocked-server';
import { HttpRequest } from 'uWebSockets.js';

type User = {
  id: string,
  name: string,
};

type DemoSession = Session<User, string>;

const demoApi = {
  add: ([a, b]: [number, number], session: DemoSession) => {
    session.dispatch(a * b);
    // Simulate processing
    return new Promise((resolve) => {
      setTimeout(() => resolve(a + b), 1000);
    });
  },
  echo: (msg: any, session: DemoSession) => msg,
};

const server = new Server<User, string>();
server.track('/a', {
  api: demoApi,
  preprocess: (req: HttpRequest) => {
    return req.getUrl();
  },
  onIdent: (token: string, params: string) => {
    return new Promise((resolve, reject) => {
      if (token !== 'demo') {
        reject(new Error('Invalid identity. Use demo'));
      } else {
        resolve({ id: token, name: params });
      }
    });
  },
  onStart: async (session: DemoSession) => {
    console.log('Session started');
    session.dispatch({ user: session.user, params: session.params });
  },
});

async function main(port: number) {
  const shutdown = await server.start(port);
  console.log(`Server started at port ${port}`);

  server.get('/', (req, res) => {
    res.end('demo Server');
  });

  server.get('/q', (req, res) => {
    shutdown();
    res.end('shutting down');
  });
}

main(7777);
