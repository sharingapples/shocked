import { Server, Session } from 'shocked-server';

type User = {
  id: string,
  name: string,
};

const demoApi = {
  add: ([a, b]: [number, number], session: Session<User>) => {
    session.dispatch(a * b);
    return (a + b);
  },
  echo: (msg: any, session: Session<User>) => msg,
};

const server = new Server<User>();
server.track('/a', {
  api: demoApi,
  onIdent: async (token: string) => {
    return new Promise((resolve) => {
      // Simulate a 500 ms delay on identification
      setTimeout(() => resolve({ id: token, name: token }), 500);
    });
  },
  onStart: async (session) => {
    console.log('Session started');
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
