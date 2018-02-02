const createSocket = require('./Socket');
const connectApi = require('./connectApi');

exports.default = createSocket;
module.exports = {
  createSocket,
  connectApi,
};
