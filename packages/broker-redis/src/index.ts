import { RedisClient } from 'redis';
import { Dispatch, Channel, Dispatcher, Unsubscribe } from 'shocked-types';

function createSubscriber(client: RedisClient) {
  const redis = client.duplicate();
  const listeners: {
    [channelId: string]: Dispatch[]
  } = {};

  redis.on('message', (channelId: string, message: any) => {
    const subscribers = listeners[channelId];
    if (!subscribers || !subscribers.length) return;
    try {
      const action = JSON.parse(message);
      subscribers.forEach(dispatch => dispatch(action));
    } catch (err) {
      // Looks like we got an invalid publish
      console.error(`PubSub error on channel ${channelId}`, err);
    }
  });

  return (channelId: string, dispatch: Dispatch) => {
    let subscribers = listeners[channelId];
    if (!subscribers) {
      subscribers = [];
      listeners[channelId] = subscribers;
      redis.subscribe(channelId);
    }

    subscribers.push(dispatch);

    return () => {
      const idx = subscribers.indexOf(dispatch);
      if (idx >= 0) {
        subscribers.splice(idx, 1);
      }

      if (subscribers.length === 0) {
        delete listeners[channelId];
        redis.unsubscribe(channelId);
      }
    };
  }
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
      const dispatch = typeof dispatcher === 'function' ? dispatcher : dispatcher.dispatch.bind(dispatcher);
      return subscriber(key(id), dispatch);
    },

    publish(id: string, message: any) {
      client.publish(key(id), JSON.stringify(message));
    },
  }
}