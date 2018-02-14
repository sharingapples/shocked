const createSocket = require('./Socket');
const connectApi = require('./connectApi');
const XHRValidator = require('./XHRValidator');

createSocket.connectApi = connectApi;
createSocket.default = createSocket;
createSocket.XHRValidator = XHRValidator;

module.exports = createSocket;
