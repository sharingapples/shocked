module.exports = function createErrorManager(emit, connect, retryInterval = 3000) {
  let errorTimer = null;
  let error = null;

  const retry = () => {
    error = null;
    errorTimer = null;
    connect();
  };

  return {
    get: () => error,
    set: (code, message, interval = retryInterval) => {
      if (errorTimer) {
        clearTimeout(errorTimer);
      }
      error = { code, message };
      emit(error);

      if (interval > 0) {
        errorTimer = setTimeout(retry, interval);
      }
    },
    clear: () => {
      if (errorTimer) {
        clearTimeout(errorTimer);
        errorTimer = null;
        error = null;
      }
    },
  };
}