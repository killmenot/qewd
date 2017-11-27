const fork = require('child_process').fork;
const QEWD_STARTED_TIMEOUT = process.env.QEWD_STARTED_TIMEOUT;
const EXIT_TIMEOUT = process.env.EXIT_TIMEOUT;

module.exports = {

  fork: (modulePath, options, callback) => {
    const cp = fork(modulePath, options);

    cp.on('message', (message) => {
      if (message.type === 'qewd:started') {
        setTimeout(callback, QEWD_STARTED_TIMEOUT);
      }
    });

    return cp;
  },

  exit: (cp, callback) => {
    cp.on('exit', () => setTimeout(callback, EXIT_TIMEOUT));
    cp.kill();
  },

  webServer: () => process.env.WEB_SERVER || 'express',

  db: () => {
    switch (process.env.DATABASE) {
      case 'cache': return {type: 'cache'};
      case 'gtm': return {type: 'gtm'};
      default: return {type: 'redis'};
    }
  }
};
