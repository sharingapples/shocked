import {
  API, API_RESPONSE, EVENT,
} from 'shocked-common';

const EventEmitter = require('events');

function getHost(endpoint) {
  if (endpoint === null || endpoint === undefined) {
    return null;
  }

  // convert http to ws
  if (endpoint.startsWith('https:') || endpoint.startsWith('http:')) {
    return 'ws'.concat(endpoint.substr(4));
  }

  // use ws as is
  if (endpoint.startsWith('wss:') || endpoint.startsWith('ws:')) {
    return endpoint;
  }

  // fallback if the endpoint is not recognizable
  throw new Error(`Invalid endpoint ${endpoint}. It should start with one of http:, https:, ws: or wss:`);
}

function createClient(endpoint, {
  netStatus = null,
  WebSocket = global.WebSocket,
  apiTimeout = 1000,
  timeout = 1000,
  maxAttempts = 10,
} = {}) {
  let host = getHost(endpoint);
  let ws = null;
  let unlisten = null;
  let apiId = 0;
  let attempts = 0;
  let timerHandle = null;

  const client = new EventEmitter();
  const apiCalls = {};

  const parsers = {
    [API_RESPONSE]: (type, id, err, res) => {
      const call = apiCalls[id];
      if (call) {
        delete apiCalls[id];
        clearTimeout(call[2]);
        if (err) {
          call[1](new Error(err));
        } else {
          call[0](res);
        }
      }
    },
    [EVENT]: (type, event, data) => {
      client.emit(event, data);
    },
  };

  const onOpen = () => {
    attempts = 0;
    client.emit('open');
  };

  const onClose = (e) => {
    // Clear the websocket instance
    ws = null;

    // Reject all open apis
    Object.keys(apiCalls).forEach((id) => {
      const [, reject] = apiCalls[id];
      delete apiCalls[id];
      reject(new Error('Connection is terminated'));
    });

    if (e.code === 4001) {
      client.emit('rejected', e.code);
    } else {
      client.emit('close', e.code);
    }

    // eslint-disable-next-line no-use-before-define
    if (e.code !== 1000 && e.code !== 1005 && e.code !== 4001) reconnect();
  };

  const onMessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      const parser = parsers[msg[0]];
      // eslint-disable-next-line prefer-spread
      if (parser) parser.apply(null, msg);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Unknown message received', err.message);
    }
  };

  function isConnected() {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  }

  function connect() {
    if (timerHandle) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }

    // Attempt to connect only when we have a end point to connect to
    if (!host) {
      return;
    }

    client.emit('connecting', attempts);
    ws = new WebSocket(host);
    ws.onopen = onOpen;
    ws.onclose = onClose;
    ws.onmessage = onMessage;
    ws.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.warn('WebSocket Error', e);
    };
  }

  function reconnect() {
    attempts += 1;
    if (attempts < maxAttempts) {
      timerHandle = setTimeout(connect, timeout);
    } else {
      client.emit('maximum', attempts);
    }
  }

  function disconnect() {
    if (timerHandle) {
      clearTimeout(timerHandle);
      timerHandle = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
  }

  const onConnectionChange = (online) => {
    if (online) {
      connect();
    } else {
      disconnect();
    }
  };

  client.setEndpoint = (endPoint) => {
    const newHost = getHost(endPoint);
    if (newHost === host) {
      return false;
    }

    disconnect();
    host = newHost;
    connect();
    return true;
  };

  client.close = () => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    disconnect();
    client.removeAllListeners();
  };

  client.execute = async (api, payload) => {
    if (!isConnected()) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      apiId += 1;
      ws.send(JSON.stringify([API, apiId, api, payload]));
      apiCalls[apiId] = [
        resolve,
        reject,
        setTimeout(() => reject(new Error('API call timed out')), apiTimeout),
      ];
    });
  };

  function open() {
    if (netStatus) {
      unlisten = netStatus.listen(onConnectionChange);
    } else {
      connect();
    }
  }

  open();
  return client;
}

export default createClient;
