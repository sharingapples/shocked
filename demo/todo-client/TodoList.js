import React, { Component } from 'react';
import { connect } from 'shocked-react';

const strike = {
  textDecoration: 'line-through',
};

class Item extends Component {
  onChange = () => {
    const { item, markComplete, clearComplete } = this.props;
    if (item.complete) {
      clearComplete(item.id);
    } else {
      markComplete(item.id);
    }
  }

  onDelete = () => {
    const { item, remove } = this.props;
    remove(item.id);
  }

  render() {
    const { item } = this.props;

    const style = item.complete ? strike : null;

    return (
      <li>
        <input type="checkbox" checked={item.complete} onChange={this.onChange} />
        <span style={style}>{item.title}</span>
        <button type="button" onClick={this.onDelete}>DEL</button>
      </li>
    );
  }
}

const mapApiToProps = ({ createApi }) => ({
  markComplete: createApi('complete'),
  clearComplete: createApi('clearComplete'),
  remove: createApi('remove'),
});

const TodoItem = connect('User')(null, mapApiToProps)(Item);

const TodoList = ({ todos }) => {
  if (todos) {
    return (
      <ul>
        {todos.map(item => <TodoItem key={item.id} item={item} />)}
      </ul>
    );
  }

  return (
    <div>Loading...</div>
  );
};

const mapStateToProps = todos => ({ todos });

export default connect('User')(mapStateToProps)(TodoList);
