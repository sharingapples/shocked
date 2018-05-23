const scopes = {};

export function createScope(name, initFn) {
  if (scopes[name]) {
    throw new Error(`A scope with the name ${name} has already been created`);
  }

  const scope = {
    apis: {},
    init: initFn,
  };

  scopes[name] = scope;

  return (api, apiName) => {
    scope.apis[apiName || api.name] = api;
  };
}

export function findScope(scopeId) {
  return scopes[scopeId];
}

