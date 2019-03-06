// API command type, send by the client
exports.API = 1;
exports.API_TYPE = 'shocked.api';

// API response send by the server
exports.API_RESPONSE = 2;

// Event emitted by the server
exports.EVENT = 5;

// Notification send by client, for proper syncing with server
exports.SYNC = 7;

// Cookie name for identifying session
exports.SESSION = 'SHOCKED_SESSION';
