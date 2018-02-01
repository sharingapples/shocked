const startServer = require('socket.red');
const WebSocket = require('ws');

const createSocket = require('../src/Socket');
const connectApi = require('../src/connectApi');

const port = 8001;

class ServerApi {
  constructor(session) {
    this.session = session;
  }

  // eslint-disable-next-line class-methods-use-this
  clap(hands) {
    if (hands <= 0) {
      throw new Error(`Invalid hands ${hands}`);
    }

    if (hands <= 2) {
      return `Clapping with ${hands} hands`;
    }

    // Emit clap events
    this.session.emit('clap', hands);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (hands > 10) {
          return reject(new Error(`Its not possible to clap with ${hands} hands`));
        }
        return resolve(`Its difficult to clap with ${hands} hands`);
      }, 100);
    });
  }

  act(value) {
    this.session.dispatch({
      type: 'ACT',
      payload: value,
    });
  }

  closeSelf() {
    this.session.close();
    return true;
  }
}

const wait = interval => new Promise(resolve => setTimeout(resolve, interval));

const expectError = async (promise, err) => {
  try {
    await promise;
  } catch (e) {
    expect(e.message).toBe(err);
    return;
  }

  throw new Error('Expected an error');
};

describe('Check client socket specification', () => {
  const sessions = {};
  let stop = null;
  beforeAll(async () => {
    stop = await startServer(port, async (url) => {
      // Add a delay for testing, use the number passed in url as milliseconds
      const interval = parseInt(url.substr(1), 10);
      await wait(interval);
      return {
        url,

        onClose: () => {
          delete sessions[url];
        },

        onStart: (session) => {
          sessions[url] = session;

          return new ServerApi(session);
        },
      };
    });
  });

  afterAll(() => {
    stop();
  });

  it('must work', async () => new Promise((resolve) => {
    const dispatch = jest.fn();

    const socket = createSocket(dispatch, {}, WebSocket);
    const api = connectApi(ServerApi, socket);
    const events = jest.fn();

    let openCount = 0;
    let disconnectCount = 0;

    socket.on('connect', async () => {
      openCount += 1;
      if (openCount === 1) {
        expect(await api.clap(2)).toBe('Clapping with 2 hands');
        expect(await api.clap(1)).toBe('Clapping with 1 hands');
        const res = await api.clap(6);
        expect(res).toBe('Its difficult to clap with 6 hands');
        await expectError(api.clap(0), 'Invalid hands 0');
        await expectError(api.clap(15), 'Its not possible to clap with 15 hands');

        await api.act(21);
        expect(dispatch.mock.calls.length).toBe(1);
        expect(dispatch.mock.calls[0][0]).toEqual({ type: 'ACT', payload: 21 });

        await api.closeSelf();

        setTimeout(() => {
          socket.close();
          setTimeout(() => {
            // Check all the final expectations
            expect(openCount).toBe(2);
            expect(disconnectCount).toBe(2);
            expect(events.mock.calls.length).toBe(2);
            expect(events.mock.calls).toEqual([['clap', 6], ['clap', 15]]);
            expect(dispatch.mock.calls.length).toBe(1);
            expect(dispatch.mock.calls).toEqual([[{ type: 'ACT', payload: 21 }]]);
            resolve();
          }, 100);
        }, 200);
      }
    });

    socket.on('disconnect', () => {
      disconnectCount += 1;
    });

    socket.on('error', e => console.error(e));
    socket.on('event', events);

    socket.open(`ws://localhost:${port}/100`);
  }));

  // TODO: Add cases to test freeze/unfreeze
});
