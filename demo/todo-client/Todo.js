import React from 'react';
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

const Todo = () => (
  <div>
    <h3>Todos</h3>
    <TodoList />
    <TodoEntry />
  </div>
);

export default track('User', ({ user }) => `todo-${user}`, reducer)(Todo);
