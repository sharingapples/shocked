module.exports = function createRPC(timeout, connect) {
  let rpcId = 0;
  const rpcs = {};

  const rpc = {
    clear: () => {
      // Reject any pending rpcs
      rpc.reject(null, { message: 'Cleaning up' });
    },
    create: () => {
      rpcId += 1;
      const id = rpcId;

      const timer = setTimeout(() => {
        rpc.reject(id, { message: `Response timed out in ${timeout} milliseconds[${id}]` });
        connect();
      }, timeout);

      const promise = new Promise((resolve, reject) => {
        rpcs[id] = [resolve, reject, timer];
      });
      return { id, promise };
    },
    resolve: (id, result) => {
      const r = rpcs[id];
      delete rpcs[id];
      if (r) {
        clearTimeout(r[2]);
        r[0](result); // Resolve call
      }
    },
    reject: (id, err) => {
      if (id) {
        const r = rpcs[id];
        delete rpcs[id];
        if (r) {
          clearTimeout(r[2]);
          r[1](err); // Reject call
        }
      } else {
        // Clear all the rpcs
        Object.keys(rpcs).forEach((key) => {
          rpc.reject(key, err);
        });
      }
    },
  };

  return rpc;
};

