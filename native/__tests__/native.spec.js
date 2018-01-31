import createSocket from '../';

describe('Check native specification', () => {
  it('must work', () => {
    createSocket(() => {});
  });
});
