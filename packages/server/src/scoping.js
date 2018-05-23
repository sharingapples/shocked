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
    const apiId = apiName || api.name;
    if (!apiId) {
      throw new Error(`Invalid api name under ${name} scope`);
    }

    if (scope.apis[apiId]) {
      throw new Error(`Can't define multiple apis with the same id ${name}/${apiId}`);
    }

    scope.apis[apiId] = api;
  };
}

export function findScope(scopeId) {
  return scopes[scopeId];
}

