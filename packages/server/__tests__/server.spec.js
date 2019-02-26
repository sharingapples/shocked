const { createClient } = require('shocked');
const WebSocket = require('isomorphic-ws');
const { createServer } = require('../src');

const echo = session => p => `${session.id}-${p}`;

const add = () => ([a, b]) => (a + b);
const err = () => () => { throw new Error('Test for error'); };
const noResponse = () => () => new Promise((resolve) => {
  setTimeout(resolve, 2000);
});

const apis = {
  echo, add, err, noResponse,
};

function eventResult(source, event) {
  return new Promise((resolve) => {
    source.once(event, (...args) => {
      if (args.length === 0) {
        return resolve(null);
      }
      return resolve(args[0]);
    });
  });
}

describe('Shocked Server Specification', () => {
  const server = createServer();
  it('checks createServer', async () => {
    expect(Object.keys(server)).toEqual(['listen', 'track', 'close']);
    Object.values(server).forEach((v) => {
      expect(typeof v).toBe('function');
    });
  });

  it('checks server listening', async () => {
    const port = await server.listen();
    expect(typeof port).toBe('number');

    const initialData = [0];
    // Add a tracker
    server.track('/u/:id', apis, () => () => () => initialData);

    const errClient = createClient(`ws://localhost:${port}/k`, null, { WebSocket });
    await expect(eventResult(errClient, 'rejected')).resolves.toBe(4001);
    errClient.close();
    const client = createClient(`ws://localhost:${port}/u/21`, null, {
      WebSocket,
      apiTimeout: 500,
    });
    await expect(eventResult(client, 'open')).resolves.toBe(null);
    client.send([0, null]); // Send serial and context
    await expect(eventResult(client, 'synced')).resolves.toEqual(initialData);
    await expect(client.execute('echo', '71')).resolves.toBe('21-71');
    await expect(client.execute('dummy', 'blah')).rejects.toThrow('Unknown api dummy');
    await expect(client.execute('add', [7, 2])).resolves.toBe(9);
    await expect(client.execute('noResponse')).rejects.toThrow('API call timed out');
    const prom = client.execute('noResponse');
    client.close();
    await expect(prom).rejects.toThrow('Connection is terminated');
  });

  it('checks server closing', () => {
    server.close();
  });
});
