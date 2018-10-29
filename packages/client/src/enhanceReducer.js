import { TYPE_TRACKER_INIT, TYPE_BATCH_ACTIONS } from 'shocked-common';

export default function enhanceReduce(reducer) {
  return function enhancedReducer(state = null, action) {
    if (action.type === TYPE_BATCH_ACTIONS) {
      return action.payload.reduce(enhancedReducer, state);
    }

    if (Array.isArray(action)) {
      return action.reduce(enhancedReducer, state);
    }

    const result = reducer(state, action);

    // Special case, if the tracker init isn't handled by the reducer
    // handle it by default
    if (action.type === TYPE_TRACKER_INIT && result === state) {
      return action.payload;
    }

    return result;
  };
}
