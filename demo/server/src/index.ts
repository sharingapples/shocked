import { Server, Session } from 'shocked-server';
import { HttpRequest } from 'uWebSockets.js';
import localChannel from 'shocked-local-broker';
import redisChannel from 'shocked-redis-broker';
import redis from 'redis';

const UserChannel = process.env.USE_REDIS ? (function() {
  const client = redis.createClient();
  const subscriber = client.duplicate();
  return redisChannel('user', client, subscriber);
}()) : localChannel('user');

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

const server = new Server();
server.track('/a', {
  api: demoApi,
  preprocess: (req: HttpRequest) => {
    return req.getUrl();
  },
  onIdent: (token: string, params: string) => {
    return new Promise<User>((resolve, reject) => {
      if (token !== 'demo') {
        reject(new Error('Invalid identity. Use demo'));
      } else {
        resolve({ id: token, name: params });
      }
    });
  },
  onStart: async (session: DemoSession) => {
    console.log('Session started');
    // Let everyone know of a new login
    // When using redis it channel, the published messaged is received even when the subscription happens after the publish
    UserChannel.publish(session.user.id, `Before sub: New user session via user channel (USER_REDIS:${process.env.USE_REDIS})`);

    session.subscribe(UserChannel, session.user.id);

    // Let everyone know of a new login
    UserChannel.publish(session.user.id, `After sub: New user session via user channel (USER_REDIS:${process.env.USE_REDIS})`);
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
