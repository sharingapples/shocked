// Registering scoping module
const scopes = {};

export function createScope(name, initFn) {
  if (scopes[name]) {
    throw new Error(`A scope with the name ${name} has already been created`);
  }

  if (typeof initFn !== 'function') {
    throw new Error(`Scope ${name} must be initialized with a function`);
  }

  scopes[name] = initFn;
}

export function getScope(scopeId, session) {
  const init = scopes[scopeId];
  if (!init) {
    throw new Error(`Scope ${scopeId} is not registered`);
  }

  return init(session);
}
