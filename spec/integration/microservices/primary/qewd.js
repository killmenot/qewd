'use strict';

const qewd = require('qewd').master;
const path = require('path');
const utils = require('../../utils');

const xp = qewd.intercept();
const q = xp.q;

q.on('start', function () {
  this.worker.loaderFilePath = path.join(__dirname, '../../../..', 'node_modules/ewd-qoper8-worker.js');
});

q.on('started', function () {
  process.send({
    type: 'qewd:started'
  });
});

const config = {
  managementPassword: 'keepThisSecret!',
  serverName: 'New QEWD Server',
  webServer: utils.webServer(),
  port: 8080,
  poolSize: 2,
  database: utils.db(),
  jwt: {
    secret: 'someSecret123'
  },
  u_services: {
    destinations: {
      login_service: {
        host: 'http://127.0.0.1:8081',
        application: 'login-micro-service'
      },
      store1: {
        host: 'http://127.0.0.1:8082',
        application: 'stock-list'
      },
      store2: {
        host: 'http://127.0.0.1:8082',
        application: 'stock-list'
      },
      all_stores: {
        destinations: ['store1', 'store2']
      }
    },
    routes: [
      {
        path: '/api/login',
        method: 'POST',
        destination: 'login_service'
      },
      {
        path: '/api/patient/:patientId/demographics',
        method: 'GET',
        destination: 'login_service'
      },
      {
        path: '/api/store/:destination/stocklist',
        method: 'GET'
      },
      {
        path: '/api/store/:destination/category/:category/stocklist',
        method: 'GET'
      },
      {
        path: '/api/store/all/stocklist',
        method: 'GET',
        destination: 'all_stores'
      }
    ]
  }
};
const routes = [
  {
    path: '/api',
    module: path.join(__dirname, 'handlers/services'),
    errors: {
      notfound: {
        text: 'Resource Not Recognised',
        statusCode: 404
      }
    }
  }
];

qewd.start(config, routes);
