export default function generateApi(client, scope, names) {
  return names.reduce((res, name) => {
    const parts = name.split('.');

    let r = res;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!r[part]) {
        r[part] = {};
      }

      r = r[part];
    }

    r[parts[parts.length - 1]] = client.rpc.bind(null, `${scope}.${name}`);
    return res;
  }, {});
}
