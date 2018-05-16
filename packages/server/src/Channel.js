const channels = {};

// TODO: Sort the sessions by session id, so its easier to search for a session
class Channel {
  constructor(name) {
    this.name = name;
    this.sessions = [];
  }

  getSessions() {
    return this.sessions;
  }

  add(session, onRemove) {
    this.sessions.push({
      session,
      onRemove,
    });

    // Remove session when closing
    session.onClose(() => this.remove(session));
  }

  remove(session) {
    const idx = this.sessions.findIndex(s => s.session === session);
    if (idx >= 0) {
      const { onRemove } = this.sessions[idx];
      if (onRemove) {
        onRemove();
      }

      this.sessions.splice(idx, 1);
    }

    // If there aren't any more session available on the channel, clear
    if (this.sessions.length === 0) {
      delete channels[this.name];
    }
  }

  dispatch(action, exclude) {
    this.sessions.forEach(({ session }) => {
      if (session !== exclude) {
        session.dispatch(action);
      }
    });
  }

  emit(event, data, exclude) {
    this.sessions.forEach(({ session }) => {
      if (session !== exclude) {
        session.emit(event, data);
      }
    });
  }
}

Channel.get = (name) => {
  if (channels[name]) {
    return channels[name];
  }

  channels[name] = new Channel(name);
  return channels[name];
};

export default Channel;
