const createSocket = require('./Socket');
const connectApi = require('./connectApi');
const XHRValidator = require('./XHRValidator');
const ValidationError = require('./ValidationError');

createSocket.connectApi = connectApi;
createSocket.default = createSocket;
createSocket.XHRValidator = XHRValidator;
createSocket.ValidationError = ValidationError;

module.exports = createSocket;
