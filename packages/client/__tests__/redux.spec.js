import { createStore, combineReducers } from 'redux';
import WebSocket from 'isomorphic-ws';
import { enhancer, setUrl } from '../src';

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
  simple: simpleReducer,
});

let port = null;
let server = null;

beforeAll(async () => {
  server = createServer();
  port = await server.listen();
});

// function storeOnChange(store) {
//   return new Promise((resolve) => {
//     const prevState = store.getState();
//     const u = store.subscribe(() => {
//       const newState = store.getState();
//       if (newState !== prevState) {
//         u();
//         resolve(newState);
//       }
//     });
//   });
// }

afterAll(() => {
  server.close();
});

describe('redux binding specifications', () => {
  it('checks for standard redux usage', async () => {
    const store = createStore(reducer, enhancer({ WebSocket }));
    setUrl(`http://localhost:${port}`);

    store.dispatch({ type: 'simple', payload: 'Foo' });
    expect(store.getState().simple.value).toBe('Foo');

    // TODO: Will need to test the shocked reducer directly
    // expect((await storeOnChange(store)).sh.connectivity).toBe('rejected');
  });
});
