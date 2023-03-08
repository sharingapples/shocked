import { RedisClient } from 'redis';
import { Channel, Dispatch, Unsubscribe } from 'shocked-types';

function createSubscriber(redis: RedisClient) {
  const listeners: {
    [channelId: string]: Dispatch[]
  } = {};

  redis.on('message', (channelId: string, message: any) => {
    const dispatchers = listeners[channelId];
    if (!dispatchers) return;
    try {
      const action = JSON.parse(message);
      dispatchers.forEach((dispatcher) => dispatcher(action));
    } catch (err) {
      // Looks like we got an invalid publish
      console.error(`PubSub error on channel ${channelId}`, err);
    }
  });

  const subscriber = {
    add: (channelId: string, dispatch: Dispatch) => {
      let dispatchers = listeners[channelId];
      if (!dispatchers) {
        dispatchers = [];
        listeners[channelId] = dispatchers;
        redis.subscribe(channelId);
      }

      dispatchers.push(dispatch);

      return () => {
        subscriber.remove(channelId, dispatch);
      };
    },
    remove: (channelId: string, dispatch: Dispatch) => {
      const dispatchers = listeners[channelId];
      if (!dispatchers) return;

      const idx = dispatchers.indexOf(dispatch);
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

export function createChannel(name: string, client: RedisClient, subscriberClient: RedisClient): Channel {
  const key = (id: string) => `${name}:${id}`;
  if (!subscriber) {
    subscriber = createSubscriber(subscriberClient);
  }

  return {
    get name() { return name; },

    subscribe(id: string, dispatch: Dispatch): Unsubscribe {
      const channelId = key(id);
      subscriber.add(channelId, dispatch);
      return () => subscriber.remove(channelId, dispatch);
    },

    unsubscribe(id: string, dispatch: Dispatch) {
      subscriber.remove(key(id), dispatch);
    },

    publish(id: string, message: any) {
      client.publish(key(id), JSON.stringify(message));
    },
  }
}