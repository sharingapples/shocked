import { PKT_TRACKER_EVENT, createParser } from 'shocked-common';
import Channel from './Channel';

class Tracker {
  constructor(session, id, result, api) {
    this.session = session;
    this.id = id;
    this.result = result;

    this.parser = createParser();
    this.channel = new Channel(id);
    this.parser.onEvent = (event, data) => {
      this.session.send(PKT_TRACKER_EVENT(id, event, data));
    };

    this.api = typeof api === 'function' ? api(this) : api;
  }

  send(message) {
    this.parser.parse(message);
  }

  emit(event, data) {
    this.channel.emit(event, data);
  }

  toJSON() {
    return {
      id: this.id,
      result: this.result,
      api: Object.keys(this.api),
    };
  }
}

export default Tracker;
