import React, { Component } from 'react';
import { track } from 'shocked-react';
import TodoList from './TodoList';
import TodoEntry from './TodoEntry';

const reducer = (state = null, action) => {
  switch (action.type) {
    case 'add_todo':
      return state.concat(action.payload);
    case 'remove_todo':
      return state.filter(item => item.id !== action.payload.id);
    case 'update_todo':
      return state.map(item => (item.id === action.payload.id ? action.payload : item));
    default:
      return state;
  }
};

class Todo extends Component {
  constructor(props) {
    super(props);

    props.tracker.on('remote', this.onRemoteEvent);
  }

  onRemoteEvent = (data) => {
    console.log('Received remote event sent from server', data);
  }

  onInit(data) {
    console.log('Initial data', data);
  }

  onConnect() {
    console.log('Todo Tracker connected');
  }

  onDisconnect() {
    console.log('Todo tracker disconnected');
  }

  render() {
    return (
      <div>
        <h3>Todos</h3>
        <TodoList />
        <TodoEntry />
      </div>
    );
  }
}

export default track('User', reducer)(Todo);
