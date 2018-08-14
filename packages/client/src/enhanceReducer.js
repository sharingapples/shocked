import { TYPE_TRACKER_INIT } from './initStore';
import { TYPE_BATCH_ACTIONS } from './batchActions';

export default function enhanceReduce(reducer) {
  return function enhancedReducer(state = null, action) {
    if (action.type === TYPE_TRACKER_INIT) {
      return action.payload;
    }

    if (action.type === TYPE_BATCH_ACTIONS) {
      return action.payload.reduce(enhancedReducer, state);
    }

    return reducer(state, action);
  };
}
