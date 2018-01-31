const createSocket = require('../src/Socket');

describe('Check client socket specification', () => {
  it('must work', () => {
    createSocket(() => {});
  });
});
