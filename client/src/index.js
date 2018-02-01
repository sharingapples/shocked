const createSocket = require('./Socket');
const connectApi = require('./connectApi');

module.exports = createSocket;
exports.connectApi = connectApi;
exports.default = createSocket;
