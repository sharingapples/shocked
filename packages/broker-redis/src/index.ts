import { RedisClient } from 'redis';
import { Channel, Dispatcher, Unsubscribe } from 'shocked-types';

function createSubscriber(client: RedisClient) {
  const redis = client.duplicate();
  const listeners: {
    [channelId: string]: Dispatcher[]
  } = {};

  redis.on('message', (channelId: string, message: any) => {
    const dispatchers = listeners[channelId];
    if (!dispatchers) return;
    try {
      const action = JSON.parse(message);
      dispatchers.forEach((dispatcher) => {
        if (typeof dispatcher === 'function') {
          dispatcher(action);
        } else  {
          dispatcher.dispatch(action);
        }
      });
    } catch (err) {
      // Looks like we got an invalid publish
      console.error(`PubSub error on channel ${channelId}`, err);
    }
  });

  const subscriber = {
    add: (channelId: string, dispatcher: Dispatcher) => {
      let dispatchers = listeners[channelId];
      if (!dispatchers) {
        dispatchers = [];
        listeners[channelId] = dispatchers;
        redis.subscribe(channelId);
      }

      dispatchers.push(dispatcher);

      return () => {
        subscriber.remove(channelId, dispatcher);
      };
    },
    remove: (channelId: string, dispatcher: Dispatcher) => {
      const dispatchers = listeners[channelId];
      if (!dispatchers) return;

      const idx = dispatchers.indexOf(dispatcher);
      if (idx >= 0) {
        dispatchers.splice(idx, 1);
      }

      if (dispatchers.length === 0) {
        delete listeners[channelId];
        redis.unsubscribe(channelId);
      }
    },
  };

  return subscriber;
}

let subscriber: ReturnType<typeof createSubscriber>;

export default function createChannel(name: string, client: RedisClient): Channel {
  const key = (id: string) => `${name}:${id}`;
  if (!subscriber) {
    subscriber = createSubscriber(client);
  }

  return {
    get name() { return name; },

    subscribe(id: string, dispatcher: Dispatcher): Unsubscribe {
      return subscriber.add(key(id), dispatcher);
    },

    unsubscribe(id: string, dispatcher: Dispatcher) {
      return subscriber.remove(key(id), dispatcher);
    },

    publish(id: string, message: any) {
      client.publish(key(id), JSON.stringify(message));
    },
  }
}