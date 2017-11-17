'use strict';

const path = require('path');

const config = {
  managementPassword: 'keepThisSecret!',
  serverName: 'New QEWD Server',
  port: 8080,
  poolSize: 2,
  database: {
    type: 'redis'
  }
};

const qewd = require('qewd').master;
const xp = qewd.intercept();
const q = xp.q;

q.on('start', function () {
  this.worker.loaderFilePath = path.join(__dirname, '../../..', 'node_modules/ewd-qoper8-worker.js');
});

q.on('started', function () {
  process.send({
    type: 'qewd:started'
  });
});

qewd.start(config);
