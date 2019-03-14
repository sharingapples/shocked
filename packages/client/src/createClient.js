import {
  API_TYPE, API, API_RESPONSE, EVENT, SESSION,
} from 'shocked-common';
import nanoid from 'nanoid/non-secure';

const EventEmitter = require('events');

export function createApi(name) {
  return payload => ({
    type: API_TYPE,
    name,
    payload,
  });
}

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

function createClient(endpoint, sessionId = null, {
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

  let currentSessionId = sessionId || nanoid();

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
    const cookie = `${SESSION}=${currentSessionId}`;
    ws = new WebSocket(host, [], { headers: { cookie } });
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

  client.isConnected = isConnected;

  function hostChanged(endPoint) {
    if (endPoint === undefined) {
      return false;
    }

    const newHost = getHost(endPoint);
    if (newHost === host) {
      return false;
    }

    host = newHost;
    return true;
  }

  function sessionChanged(newSessionId) {
    if (!newSessionId || newSessionId === currentSessionId) {
      return false;
    }

    currentSessionId = newSessionId;
    return true;
  }

  client.setEndpoint = (endPoint, newSessionId) => {
    // We need both the methods to run, since we are updating
    // values internally.
    const hasHostChanged = hostChanged(endPoint);
    const hasSessionChanged = sessionChanged(newSessionId);
    if (hasHostChanged || hasSessionChanged) {
      disconnect();
      connect();
      return true;
    }

    return false;
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
      client.send([API, apiId, api, payload]);
      apiCalls[apiId] = [
        resolve,
        reject,
        setTimeout(() => reject(new Error('API call timed out')), apiTimeout),
      ];
    });
  };

  client.send = (data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
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
