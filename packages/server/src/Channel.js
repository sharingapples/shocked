import encodeAction from './_encodeAction';
import encodeEvent from './_encodeEvent';

class Channel {
  constructor(id) {
    this.id = id;
  }

  dispatch(action) {
    return Channel.provider.publish(this.id, encodeAction(action));
  }

  emit(event, data) {
    return Channel.provider.publish(this.id, encodeEvent(event, data));
  }
}

Channel.subscribe = (id, session) => Channel.provider.subscribe(this.id, session);

Channel.setProvider = (provider) => {
  Channel.provider = provider;
};

export default Channel;
