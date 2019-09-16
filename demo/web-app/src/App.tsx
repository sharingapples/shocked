import React, { useState, useCallback, ChangeEvent } from 'react';
import { Shocked } from 'shocked';
import Connection from './Connection';

import './App.css';
import Summation from './Summation';

function dispatch(action: any) {
  console.log('Dispatch', action);
}

const api = {
  add: null,
  echo: null,
};

type NetworkCallback = (network: boolean) => void;
const listeners: NetworkCallback[] = [];
let networkStatus = true;

function setNetworkStatus(status: boolean) {
  if (networkStatus === status) return;
  networkStatus = status;
  listeners.forEach(l => l(status));
}

function networkProvider(listener: NetworkCallback) {
  listeners.push(listener);
  listener(networkStatus);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) {
      listeners.splice(idx, 1);
    }
  }
}

const App: React.FC = () => {
  const [ident, setIdent] = useState('demo');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIdent(e.target.value);
  }, []);

  const logout = useCallback(() => setIdent(''), []);
  const changeNetworkStatus = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setNetworkStatus(Boolean(parseInt(e.target.value)));
  }, []);
  return (
    <Shocked
      url="ws://localhost:7777/a"
      ident={ident}
      clearIdent={logout}
      dispatch={dispatch}
      api={api}
      networkProvider={networkProvider}
    >
      <div className="App">
        <header className="App-header">
          <h1>
            Demo Client
          </h1>
          <div>
            Change Network Status
            <select onChange={changeNetworkStatus} defaultValue="1">
              <option value="1">On</option>
              <option value="0">Off</option>
            </select>
          </div>
          <div>
            Login Ident: <input type="text" defaultValue={ident} onChange={handleChange} />
            <p>Use `demo` as a valid ident, anything else is invalid</p>
          </div>
          <Connection />
          <Summation />
        </header>
      </div>
    </Shocked>
  );
}

export default App;
