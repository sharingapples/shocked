const TYPE_RPC_REQUEST = 1;
const TYPE_RPC_RESPONSE = 2;
const TYPE_EVENT = 3;
const TYPE_ACTION = 4;
const TYPE_SCOPE_REQUEST = 5;
const TYPE_SCOPE_RESPONSE = 6;
const TYPE_CALL = 7;

const METHOD_MAPS = {
  [TYPE_RPC_REQUEST]: 'onRpcRequest',
  [TYPE_RPC_RESPONSE]: 'onRpcResponse',
  [TYPE_EVENT]: 'onEvent',
  [TYPE_ACTION]: 'onAction',
  [TYPE_SCOPE_REQUEST]: 'onScopeRequest',
  [TYPE_SCOPE_RESPONSE]: 'onScopeResponse',
  [TYPE_CALL]: 'onCall',
};

export function PKT_RPC_REQUEST(tracker, scope, api, args) {
  return JSON.stringify([TYPE_RPC_REQUEST, tracker, scope, api, args]);
}

export function PKT_RPC_RESPONSE(tracker, success, result) {
  return JSON.stringify([TYPE_RPC_RESPONSE, tracker, success, result]);
}

export function PKT_EVENT(name, data) {
  return JSON.stringify([TYPE_EVENT, name, data]);
}

export function PKT_ACTION(action) {
  return JSON.stringify([TYPE_ACTION, action]);
}

export function PKT_SCOPE_REQUEST(tracker, name, version) {
  return JSON.stringify([TYPE_SCOPE_REQUEST, tracker, name, version]);
}

export function PKT_SCOPE_RESPONSE(tracker, success, result) {
  return JSON.stringify([TYPE_SCOPE_RESPONSE, tracker, success, result]);
}

export function PKT_CALL(scope, api, args) {
  return JSON.stringify([TYPE_CALL, scope, api, args]);
}

export function createParser() {
  const parser = {
    parse: (message) => {
      try {
        const data = JSON.parse(message);
        if (!Array.isArray(data)) {
          throw new Error('Invalid message format');
        }

        const [type, ...other] = data;
        const method = METHOD_MAPS[type];
        if (!method) {
          throw new Error(`Unknown message type - ${type}`);
        }

        if (!parser[method]) {
          throw new Error(`No parser defined for - ${method}`);
        }

        try {
          parser[method].apply(null, other);
        } catch (err) {
          throw new Error(`Error executing parser - ${method} - ${err.message}`);
        }
      } catch (err) {
        if (parser.onError) {
          parser.onError(err);
        } else {
          // eslint-disable-next-line no-console
          console.error('Error parsing message', err);
        }
      }
    },
  };

  return parser;
}
