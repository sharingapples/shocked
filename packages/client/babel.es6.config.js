const basic = require('./babel.config');

basic.presets[0] = [
  '@babel/preset-env',
  {
    targets: {
      esmodules: true,
    },
  },
];

module.exports = basic;
