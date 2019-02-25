const { createClient } = require('shocked-client');
const WebSocket = require('isomorphic-ws');
const { createServer } = require('../src');

const echo = session => p => `${session.id}-${p}`;

const add = () => ([a, b]) => (a + b);
const err = () => () => { throw new Error('Test for error'); };
const noResponse = () => () => new Promise((resolve) => {
  setTimeout(resolve, 2000);
});

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

    // Add a tracker
    server.track('/u/:id', () => ({
      echo,
      add,
      err,
      noResponse,
    }));

    const errClient = createClient(`ws://localhost:${port}/k`);
    expect(new Promise((resolve) => {
      errClient.on('close', e => resolve(e.code));
    })).resolves.toBe(4001);
    errClient.close();

    const client = createClient(`ws://localhost:${port}/u/21`, {
      WebSocket,
      apiTimeout: 100,
    });
    const open = () => new Promise((resolve) => {
      client.on('open', resolve);
    });
    await open();
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
