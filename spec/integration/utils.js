const fork = require('child_process').fork;

module.exports = {

  fork: (modulePath, options, callback) => {
    const cp = fork(modulePath, options);

    cp.on('message', (message) => {
      if (message.type === 'qewd:started') {
        callback();
      }
    });

    return cp;
  },

  exit: (cp, callback) => {
    cp.on('exit', () => callback());
    cp.kill();
  }
};
