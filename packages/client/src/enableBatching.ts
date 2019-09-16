import { BATCH } from 'shocked-common';

export default function enableBatching(reducer) {
  return function batchingReducer(state, action) {
    if (action.type === BATCH) {
      return action.payload.reduce(batchingReducer, state);
    }

    return reducer(state, action);
  };
}
