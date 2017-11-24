const fork = require('child_process').fork;

module.exports = {

  fork: (modulePath, options, callback) => {
    const cp = fork(modulePath, options);

    cp.on('message', (message) => {
      if (message.type === 'qewd:started') {
        setTimeout(callback, 100);
      }
    });

    return cp;
  },

  exit: (cp, callback) => {
    cp.on('exit', () => setTimeout(callback, 100));
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
