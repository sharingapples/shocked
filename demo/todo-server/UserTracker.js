const { Tracker, Channel } = require('shocked');

const todos = {};

let uniquedId = 0;

const getTodos = (id) => {
  if (!todos[id]) {
    todos[id] = {};
  }

  return todos[id];
};

const createTodo = (userId, title) => {
  // eslint-disable-next-line no-plusplus
  const id = ++uniquedId;
  const todo = { id, title, complete: false };
  getTodos(userId)[id] = todo;
  return todo;
};

class UserTracker extends Tracker {
  getChannelId() {
    const org = this.session.get('org');
    return `org-${org.id}`;
  }

  getData() {
    const user = this.session.get('user');
    const res = getTodos(user);
    return Object.keys(res).map(id => res[id]);
  }

  onCreate() {
    const user = this.session.get('user');
    this.userId = user;

    return new Channel('todo');
  }

  add(title) {
    const { userId } = this;
    console.log('Adding todo item', userId, title);

    const todo = createTodo(userId, title);
    this.dispatch({ type: 'add_todo', payload: todo });
    return todo;
  }

  remove(id) {
    const { userId } = this;
    const all = getTodos(userId);
    const todo = all[id];
    if (todo) {
      delete all[id];
      this.dispatch({ type: 'remove_todo', payload: todo });
      return true;
    }

    return false;
  }

  complete(id) {
    const { userId } = this;
    const all = getTodos(userId);
    const todo = all[id];
    if (todo) {
      todo.complete = true;
      this.dispatch({ type: 'update_todo', payload: todo });
      return true;
    }
    return false;
  }

  clearComplete(id) {
    const { userId } = this;
    const all = getTodos(userId);
    const todo = all[id];
    if (todo) {
      todo.complete = false;
      this.dispatch({ type: 'update_todo', payload: todo });
      return true;
    }

    return false;
  }
}

module.exports = UserTracker;
