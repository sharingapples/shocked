const path = require('path');
const serve = require('serve-static')(path.resolve(__dirname, 'static'));

module.exports = function setupDebug(app) {
  app.use('/debug', serve);
};
