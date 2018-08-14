import React, { Component } from 'react';
import { connect } from 'shocked-react';

class TodoEntry extends Component {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
    };
  }

  onSubmit = async () => {
    const { add } = this.props;
    const { title } = this.state;

    if (title) {
      console.log('Submit via add', title);
      await add(title);
      this.setState({
        title: '',
      });
    }
  }

  handleChange(name) {
    return (e) => {
      this.setState({
        [name]: e.target.value,
      });
    };
  }

  render() {
    const { title } = this.state;

    return (
      <div>
        <input type="text" value={title} onChange={this.handleChange('title')} />
        <input type="submit" onClick={this.onSubmit} />
      </div>
    );
  }
}

const mapApiToProps = ({ createApi }) => ({
  add: createApi('add'),
});

export default connect('User')(null, mapApiToProps)(TodoEntry);
