const createSocket = require('./Socket');
const connectApi = require('./connectApi');

createSocket.connectApi = connectApi;
createSocket.default = createSocket;
module.exports = createSocket;
