import { Channel, Dispatcher } from 'shocked-types';

// A PoC local broker that works only on a single server system
// Use somthing like redis for a more distributed pub/sub brokering
export default function createChannel(name: string): Channel {
  const listeners: {
    [id: string]: Dispatcher[],
  } = {};

  const channel = {
    get name() { return name; },

    subscribe(id: string, dispatcher: Dispatcher) {
      let dispatchers = listeners[id];
      if (!dispatchers) {
        dispatchers = [];
        listeners[id] = dispatchers;
      }

      dispatchers.push(dispatcher);
      return () => {
        return channel.unsubscribe(id, dispatcher);
      };
    },
    unsubscribe(id: string, dispatcher: Dispatcher) {
      const dispatchers = listeners[id];
      if (!dispatchers) return;

      const idx = dispatchers.indexOf(dispatcher);
      if (idx >= 0) {
        dispatchers.splice(idx, 1);
      }
    },
    publish(id: string, message: any) {
      const dispatchers = listeners[id];
      if (!dispatchers || !dispatchers.length) return;
      dispatchers.forEach((dispatcher) => {
        if (typeof dispatcher === 'function') {
          dispatcher(message);
        } else {
          dispatcher.dispatch(message);
        }
      });
    },
  };

  return channel;
}

