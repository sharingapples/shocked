export const TYPE_TRACKER_INIT = '$shocked.init';

export const initStore = data => ({
  type: TYPE_TRACKER_INIT,
  payload: data,
});
