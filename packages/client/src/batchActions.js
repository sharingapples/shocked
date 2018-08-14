export const TYPE_BATCH_ACTIONS = '$shocked.batch';

export const batchActions = actions => ({
  type: TYPE_BATCH_ACTIONS,
  payload: actions,
});
