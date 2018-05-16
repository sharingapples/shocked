const apis = {};

export function binder(api, qualifiedName, scoper) {
  if (apis[qualifiedName]) {
    throw new Error(`API ${qualifiedName} is already declared`);
  }
  console.log('Binding api', qualifiedName);

  apis[qualifiedName] = {
    scoper,
    fn: api,
  };

  return qualifiedName;
}

export function createScope(scopeName, scoping) {
  return (api, name) => {
    const apiName = name || api.name;
    binder(api, `${scopeName}.${apiName}`, { name: scopeName, scoping });
  };
}

export function executeApi(session, name, args) {
  const api = apis[name];
  if (!api) {
    throw new Error(`Unknown API ${name}`);
  }

  // If there is a scope to initialize initialize
  const scope = api.scoper ? session.scope(api.scoper.name, api.scoper.scoping) : null;

  const self = {
    session,
    scope,
  };

  return api.fn.apply(self, args);
}
