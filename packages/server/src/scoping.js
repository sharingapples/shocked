// Registering scoping module
console.log('Scoping start');
const scopes = {};

export function createScope(name, initFn) {
  if (scopes[name]) {
    throw new Error(`A scope with the name ${name} has already been created`);
  }

  const scope = {
    apis: {},
    init: initFn,
  };

  console.log(`Registering scope ${name}`);
  scopes[name] = scope;
  console.log('scopes', scopes);

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

export function getScope(scopeId, session) {
  console.log('Retriveing scope', scopes);
  const scope = scopes[scopeId];
  if (!scope) {
    throw new Error(`Scope ${scopeId} is not registered`);
  }

  // First try to initialize the scope
  if (scope.init) {
    scope.init(session);
  }

  // Bind the session to all the scope apis
  return Object.keys(scope.apis).reduce((res, name) => {
    res[name] = scope.apis[name](session);
    return res;
  }, {});
}
