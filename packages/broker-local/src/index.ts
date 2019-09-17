import { Channel, Dispatch } from 'shocked-types';

// A PoC local broker that works only on a single server system
// Use somthing like redis for a more distributed pub/sub brokering
export default function createChannel(name: string): Channel {
  const listeners: {
    [id: string]: Dispatch[],
  } = {};

  const channel = {
    get name() { return name; },

    subscribe(id: string, dispatch: Dispatch) {
      let dispatchers = listeners[id];
      if (!dispatchers) {
        dispatchers = [];
        listeners[id] = dispatchers;
      }

      dispatchers.push(dispatch);
      return () => {
        return channel.unsubscribe(id, dispatch);
      };
    },
    unsubscribe(id: string, dispatch: Dispatch) {
      const dispatchers = listeners[id];
      if (!dispatchers) return;

      const idx = dispatchers.indexOf(dispatch);
      if (idx >= 0) {
        dispatchers.splice(idx, 1);
      }
    },
    publish(id: string, message: any) {
      const dispatchers = listeners[id];
      if (!dispatchers || !dispatchers.length) return;
      dispatchers.forEach((dispatch) => dispatch(message));
    },
  };

  return channel;
}

