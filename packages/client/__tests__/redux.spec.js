import { createStore, combineReducers } from 'redux';
import WebSocket from 'isomorphic-ws';
import { enhancer, getConnectivity, shockedReducer } from '../src';

const createServer = require('shocked-server');

const simpleReducer = (state = {}, action) => {
  if (action.type === 'simple') {
    return {
      value: action.payload,
      ...state,
    };
  }

  return state;
};

const reducer = combineReducers({
  sh: shockedReducer,
  simple: simpleReducer,
});

let port = null;

beforeAll(async () => {
  const server = createServer();
  port = await server.listen();
});

function storeOnChange(store) {
  return new Promise((resolve) => {
    const prevState = store.getState();
    const u = store.subscribe(() => {
      const newState = store.getState();
      if (newState !== prevState) {
        u();
        resolve(newState);
      }
    });
  });
}

describe('redux binding specifications', () => {
  it('checks for standard redux usage', async () => {
    const store = createStore(reducer, enhancer(`http://localhost:${port}`, null, { WebSocket }));
    store.dispatch({ type: 'simple', payload: 'Foo' });
    expect(store.getState().simple.value).toBe('Foo');
    expect(getConnectivity(store.getState().sh)).toBeUndefined();

    expect((await storeOnChange(store)).sh.connectivity).toBe('rejected');
  });
});
