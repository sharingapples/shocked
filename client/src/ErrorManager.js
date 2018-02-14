const CONNECT = 'CONNECT';
const VALIDATION = 'VALIDATION';
const FROZEN = 'FROZEN';
const GENERIC = 'GENERIC';

module.exports = function createErrorManager(emit, connect, retryInterval = 3000) {
  let errorTimer = null;
  let currentError = null;

  const retry = () => {
    currentError = null;
    errorTimer = null;
    connect();
  };

  const setError = (type, error, interval = retryInterval) => {
    if (errorTimer) {
      clearTimeout(errorTimer);
      errorTimer = null;
    }
    currentError = { type, error };
    emit(error);

    if (interval > 0) {
      errorTimer = setTimeout(retry, interval);
    }
  };

  return {
    get: () => currentError,
    setConnectError: (error, interval) => {
      setError(CONNECT, error, interval);
    },
    setValidationError: (error, interval) => {
      setError(VALIDATION, error, interval);
    },
    setGenericError: (error, interval) => {
      setError(GENERIC, error, interval);
    },
    setFrozenError: () => {
      setError(FROZEN, null, 0);
    },
    clear: () => {
      if (errorTimer) {
        clearTimeout(errorTimer);
        errorTimer = null;
      }
      currentError = null;
    },
  };
};
