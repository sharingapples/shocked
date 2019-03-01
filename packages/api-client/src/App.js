import React, { Component } from 'react';
import { createClient } from 'shocked';

import './App.css';

const Output = React.memo(({ content }) => {
  return (
    <div className="output">
      {content.map(({id, time, message, preview}) => {
        const isObject = message && preview;
        const objExpansion = isObject ? (() => {
          console.log(message);
          alert('Check console for the full object');
        }) : undefined;

        return (
            <div key={id}>
            <span className="time">{time.toLocaleTimeString()}</span>
            <span
              className={isObject?"object":"message"}
              onClick={objExpansion}
            >
              {preview || message }
            </span>
          </div>
        );
      })}
    </div>
  );
});

class App extends Component {
  state = {
    url: window.location.href,
    sessionId: '',
    context: '{\n  \n}',
    api: '',
    payload: '{\n  \n}',

    processing: false,
    output: [],
  };

  handleChange = (name) => (e) => {
    this.setState({
      [name]: e.target.value,
    });
  }

  Input = ({ label, name }) => (
    <div className="row">
      <label>{label}</label>
      <input type="text" value={this.state[name]} onChange={this.handleChange(name)} />
    </div>
  );

  TextArea = ({ label, name }) => (
    <div className="row">
      <label>{label}</label>
      <textarea value={this.state[name]} onChange={this.handleChange(name)} />
    </div>
  );

  setMessage = (message, processing = true) => {
    let preview = null;
    const isObject = typeof message === "object";
    if (isObject) {
      preview = JSON.stringify(message);
      if (preview.length >= 40) {
        preview = `${preview.substr(0, 20)} ... ${preview.substr(-3, 3)}`;
      }
      const type = (Array.isArray(message)) ? 'Array ' : 'Object ';
      preview = `${type}${preview}`;
    }

    this.setState((prev) => ({
      output: prev.output.concat([{
        id: prev.output.length,
        time: new Date(),
        message,
        preview,
      }]),
    }));
  }

  onStart = () => {
    const { url, sessionId, context, api, payload } = this.state;
    this.setMessage('Connecting...', true);

    const client = createClient(url, sessionId || null, { });
    client.on('open', () => {
      this.setMessage('Connected');
      client.send([0, context]);
    });

    client.on('rejected', () => {
      this.setMessage(`Connection Rejected. Check your url for proper tracker.`, false);
    });

    client.on('maximum', () => {
      client.close();
      this.setMessage(`Closing after maximum fail attempts`, false);
    });

    client.on('close', () => {
      this.setMessage('Failed');
    })

    client.on('synced', async (actions, serial) => {
      this.setMessage(`Synced: serial: ${serial}, InitialActions`);
      this.setMessage(actions);

      if (!api) {
        this.setMessage('No API to execute. Closing.', false);
        client.close();
        return;
      }

      this.setMessage(`Executing API: ${api}`);
      try {
        const res = await client.execute(api, JSON.parse(payload));
        this.setMessage(`API response <${res}>`);
      } catch (err) {
        this.setMessage(`API execution failed ${err.message}`);
      }
    });
  }

  render() {
    const Input = this.Input;
    const TextArea = this.TextArea;
    const { processing, output } = this.state;

    return (
      <div className="App">
        <div className="form">
          <Input label="URL" name="url" />
          <Input label="Session ID" name="sessionId" />
          <TextArea label="Context" name="context" />
          <Input label="API" name="api" />
          <TextArea label="Payload" name="payload" />
          <div className="row">
            <button disabled={processing} onClick={this.onStart}>Execute</button>
            <button onClick={() => this.setState({ output: [] })}>Clear</button>
          </div>
        </div>
        <Output content={output} />
      </div>
    );
  }
}

export default App;
