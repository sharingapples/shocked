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

export function findApi(scopeId, name) {
  const scope = scopes[scopeId];
  if (!scope) {
    throw new Error(`Unknown scope ${scope}`);
  }

  return scope.apis[name];
}
