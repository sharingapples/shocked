import React from 'react';
import { Shocked } from 'shocked';
import Connection from './Connection';

import logo from './logo.svg';
import './App.css';
import Summation from './Summation';

function logout() {
  console.log('Logout');
}

function dispatch(action: any) {
  console.log('Dispatch', action);
}

const api = {
  add: null,
  echo: null,
};

const App: React.FC = () => {
  return (
    <Shocked
      url="ws://localhost:7777/a"
      ident="demo"
      clearIdent={logout}
      dispatch={dispatch}
      api={api}
    >
      <div className="App">
        <header className="App-header">
          Demo Client
          <Connection />
          <Summation />
        </header>
      </div>
    </Shocked>
  );
}

export default App;
