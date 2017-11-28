const fork = require('child_process').fork;
const isUUID = require('is-uuid');
const isJWT = require('is-jwt');

module.exports = {

  fork: (modulePath, options, callback) => {
    const cp = fork(modulePath, options);

    cp.on('message', (message) => {
      if (message.type === 'qewd:started') {
        setTimeout(callback, process.env.QEWD_STARTED_TIMEOUT);
      }
    });

    return cp;
  },

  exit: (cp, callback) => {
    cp.on('exit', () => setTimeout(callback, process.env.EXIT_TIMEOUT));
    cp.kill();
  },

  webServer: () => process.env.WEB_SERVER || 'express',

  db: () => {
    switch (process.env.DATABASE) {
      case 'cache': return {type: 'cache'};
      case 'gtm': return {type: 'gtm'};
      default: return {type: 'redis'};
    }
  },

  isUUID: x => isUUID.v4(x),

  isJWT: (x) => isJWT(x),
};
