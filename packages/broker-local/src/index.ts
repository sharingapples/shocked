import { Channel, Dispatcher, Dispatch } from 'shocked-types';

// A PoC local broker that works only on a single server system
// Use somthing like redis for a more distributed pub/sub brokering
export default function createChannel(name: string): Channel {
  const dispatchers: {
    [id: string]: Dispatch[],
  } = {};

  return {
    get name() { return name; },

    subscribe(id: string, dispatcher: Dispatcher) {
      const list = dispatchers[id] || [];
      dispatchers[id] = list;

      const dispatch = typeof dispatcher === 'function' ? dispatcher : dispatcher.dispatch.bind(dispatcher);

      list.push(dispatch);
      return () => {
        const idx = list.indexOf(dispatch);
        if (idx >= 0) {
          list.splice(idx, 1);
        }
      }
    },
    publish(id: string, message: any) {
      const list = dispatchers[id];
      if (!list || !list.length) return;
      list.forEach(dispatch => dispatch(message));
    },
  }
}

