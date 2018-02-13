
const startServer = require('../src/server');
const WebSocket = require('ws');

const port = 8001;

describe('WebSocket Server Specification', () => {
  let stop = null;
  const api = {
    fn1: jest.fn(),
    sum: (a, b) => a + b,
    err: (msg) => {
      throw new Error(msg);
    },
  };
  const session = {
    onStart: () => {
      session.emit('eee', 'John');
      session.dispatch({ type: 'ACTION', payload: 'Doe' });
      return api;
    },
  };

  beforeAll(async () => {
    stop = await startServer(port, (url) => {
      if (url === '/err') {
        return null;
      }

      session.url = url;

      return session;
    });
  });

  afterAll(() => {
    stop();
  });

  it('must start properly', async () => new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}`);

    function send(obj) {
      return new Promise((sendResolve, reject) => {
        socket.send(JSON.stringify(obj), (err) => {
          if (err) {
            return reject(err);
          }

          return sendResolve();
        });
      });
    }

    socket.onerror = jest.fn();

    socket.onmessage = jest.fn();

    let count = 0;
    socket.on('message', () => {
      count += 1;
      if (count === 6) {
        socket.close();
      }
    });

    socket.on('open', () => {
      send([1, 'fn1', [1, 2, 3]]);
      send([2, 'fn2', [4]]);
      send([3, 'sum', [4, 5]]);
      send([4, 'err', ['Echo Error']]);
    });

    socket.on('close', () => {
      expect(typeof session.dispatch).toBe('function');
      expect(typeof session.emit).toBe('function');

      expect(api.fn1.mock.calls.length).toBe(1);
      const messages = socket.onmessage.mock.calls.map(c => JSON.parse(c[0].data));
      messages.sort((a, b) => a[0] - b[0]);
      expect(messages.length).toBe(6);
      expect(messages[0]).toEqual([-1, 'eee', 'John']);
      expect(messages[1]).toEqual([0, { type: 'ACTION', payload: 'Doe' }]);
      expect(messages[2]).toEqual([1, true, null]);
      expect(messages[3]).toEqual([2, false, 'Unknown api \'fn2\'']);
      expect(messages[4]).toEqual([3, true, 9]);
      expect(messages[5]).toEqual([4, false, 'Echo Error']);
      expect(socket.onerror.mock.calls.length).toBe(0);
      expect(session.url).toBe('/');

      resolve();
    });
  }));

  it('must handle error', async () => new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}/err`);
    socket.onopen = jest.fn();
    socket.onerror = jest.fn();

    socket.on('close', () => {
      expect(socket.onopen.mock.calls.length).toBe(0);
      expect(socket.onerror.mock.calls.length).toBe(1);
      resolve();
    });
  }));
});
