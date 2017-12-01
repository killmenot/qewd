'use strict';

const qewd = require('qewd').master;
const path = require('path');
const utils = require('../utils');

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

const config = {
  managementPassword: 'keepThisSecret!',
  serverName: 'My QEWD Server',
  webServer: utils.webServer(),
  port: 8080,
  poolSize: 2,
  database: utils.db()
};
const routes = [
  {
    path: '/api',
    module: path.join(__dirname, 'handlers'),
    beforeRouter: [utils.beforeRouter(config.webServer)],
    afterRouter: [utils.afterRouter(config.webServer)]
  }
];

qewd.start(config, routes);
