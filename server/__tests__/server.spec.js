const startServer = require('../src/server');
const WebSocket = require('ws');

describe('WebSocket Server Specification', () => {
  it('must start properly', async () => {
    const session = {
      end: () => {},
      api: {
        fn1: jest.fn(),
        sum: (a, b) => a + b,
        err: (msg) => {
          throw new Error(msg);
        },
      },
    };
    const stop = await startServer(8002, (url) => {
      session.url = url;

      setImmediate(() => {
        session.emit('eee', 'John');
        session.dispatch({ type: 'ACTION', payload: 'Doe' });
      });
      return session;
    });

    const socket = new WebSocket('ws://localhost:8002');
    socket.on('open', () => {
      socket.send(JSON.stringify([1, 'fn1', [1, 2, 3]]));
      socket.send(JSON.stringify([2, 'fn2', [4]]));
      socket.send(JSON.stringify([3, 'sum', [4, 5]]));
      socket.send(JSON.stringify([4, 'err', ['Echo Error']]));
    });

    socket.onclose = jest.fn();
    socket.onerror = jest.fn();
    socket.onmessage = jest.fn();

    return new Promise((resolve) => {
      setTimeout(() => {
        stop();
        expect(typeof session.dispatch).toBe('function');
        expect(typeof session.emit).toBe('function');

        expect(session.api.fn1.mock.calls.length).toBe(1);
        const messages = socket.onmessage.mock.calls.map(c => JSON.parse(c[0].data));
        messages.sort((a, b) => a[0] - b[0]);
        expect(messages.length).toBe(6);
        expect(messages[0]).toEqual([-1, 'eee', 'John']);
        expect(messages[1]).toEqual([0, { type: 'ACTION', payload: 'Doe' }]);
        expect(messages[2]).toEqual([1, true, null]);
        expect(messages[3]).toEqual([2, false, 'Unknown api \'fn2\'']);
        expect(messages[4]).toEqual([3, true, 9]);
        expect(messages[5]).toEqual([4, false, 'Echo Error']);
        // console.log(socket.onmessage.mock.calls);
        // expect(socket.onerror.mock.calls.length).toBe(0);
        expect(session.url).toBe('/');
        resolve();
      }, 100);
    });
  });
});
