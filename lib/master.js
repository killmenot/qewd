/*

 ----------------------------------------------------------------------------
 | qewd: Quick and Easy Web Development                                     |
 |                                                                          |
 | Copyright (c) 2017 M/Gateway Developments Ltd,                           |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  9 October 2017

   Thanks to:
    Ward De Backer for body-parser enhancement
    and pre-forking code (for use with debuggers)

*/

/*
// Example usage

var params = {
  managementPassword: 'keepThisSecret!',
  serverName: 'New EWD Server',
  port: 8081,
  poolSize: 1
};
var qewd = require('qewd').master;

// if you want to define REST/web service URL paths with associated routing:

var routes = [
  {
    path: '/testx' // module will default to testx.js
  },
  {
    path: '/patient',
    module: 'my-patient-module'
  }
];

var q = qewd.start(config, routes);

 // if you want to add your own user-defined objects that will be
 //  available in the worker process(es) (in the this.userDefined object):

q.userDefined['myCustomObject'] = { // your object };

*/

var fs = require('fs');
var qoper8 = require('ewd-qoper8');
var sockets = require('./sockets');
var configureMicroServices = require('./microServices');
var debug = require('debug')('qewd:master');

var q = new qoper8.masterProcess(); // eslint-disable-line new-cap
var app;
var qx;

function start(params, routes) {
  var emptyMap = !params.moduleMap;
  var moduleMap = params.moduleMap || {};

  debug('params: %s', JSON.stringify(params));
  debug('routes: %s', JSON.stringify(routes));

  if (routes) {
    routes.forEach(function(route) {
      var path = route.path;
      if (path.charAt(0) === '/') {
        path = path.substring(1);
      }
      var module = route.module || path;
      moduleMap[path] = module;
      emptyMap = false;
    });
  }
  if (emptyMap) moduleMap = false;

  var config = {
    managementPassword: params.managementPassword || 'keepThisSecret',
    serverName: params.serverName || 'qewd',
    port: params.port || 8080,
    poolSize: params.poolSize || 1,
    poolPrefork: params.poolPrefork || false,
    idleLimit: params.idleLimit || 3600000,
    webServer: params.webServer || 'express',
    webServerRootPath: params.webServerRootPath || process.cwd() + '/www/',
    no_sockets: params.no_sockets || false,
    webSockets: params.webSockets || {module: 'socket.io'},
    ssl: params.ssl || false,  // for ssl mode: ssl: {keyFilePath: 'xxx.key', certFilePath: 'xxx.crt'},
    cors: params.cors || false,
    masterProcessPid: process.pid,
    database: params.database,
    errorLogFile: params.errorLogFile || false,
    mode: params.mode || 'production',
    bodyParser: params.bodyParser || false, // allow the user to pass in its own bodyParser
    addMiddleware: params.addMiddleware || false, // allow the user to add custom Express middleware
    initialSessionTimeout: params.initialSessionTimeout || 300,
    sessionDocumentName: params.sessionDocumentName || 'CacheTempEWDSession',
    moduleMap: moduleMap,
    lockSession: params.lockSession || false,  // true | {timeout: 60}
    resilientMode: params.resilientMode || false,
    customSocketModule: params.customSocketModule || false,
    jwt: params.jwt || false
  };

  if (params.resilientMode) {
    config.resilientMode = {
      documentName: params.resilientMode.queueDocumentName || 'ewdQueue',
      keepPeriod: params.resilientMode.keepPeriod || 3600
    };
  }

  if (config.webServer !== 'express' && config.webServer !== 'koa') config.webServer = 'express';

  if (config.jwt) {
    q.jwt = config.jwt;
    q.jwt.handlers = require('./jwtHandler');
  }

  if (params.u_services) {
    configureMicroServices.call(q, params.u_services);
  }

  qx = require('ewd-qoper8-' + config.webServer);
  var wsConfig = require('./master-' + config.webServer);
  qx.addTo(q);
  config.qxBuild = qx.build;

  debug('config: %s', JSON.stringify(config));

  app = wsConfig(config, routes, q, qx);

  q.on('start', function() {
    this.worker.module = 'qewd.worker';

    this.setWorkerPoolSize(config.poolSize);
    this.setWorkerIdleLimit(config.idleLimit);

    if (params.database && params.resilientMode) {
      // connect master process to database
      //  it will use asynch connections to save a copy of
      //  each queued request, and delete them when done
      debug('starting resilient mode..');
      this.resilientMode = {
        documentName: config.resilientMode.documentName
      };
      var db = params.database;
      var type = db.type;

      if (type === 'cache') db.params.lock = '1';
      if (type === 'cache' || type === 'gtm' || type === 'redis') {
        debug('connecting master process to %s', type);
        this.on('dbOpened', function() {
          if (type !== 'redis') {
            debug('version: %s', JSON.stringify(this.db.version()));
          }
          else {
            this.db.version(function(version) {
              debug('version: %s', version);
            });
          }
        });
        this.on('dbClosed', function() {
          debug('Connection to %s closed', db.type);
        });

        if (type === 'redis') {
          if (!db.params) db.params = {};
          // master process must use Redis async mode (just for sets and kills)
          var redisParams = {
            host: db.params.host,
            port: db.params.port,
            integer_padding: db.params.integer_padding,
            key_separator: db.params.key_separator,
            async: true
          };
          debug('starting %s in master process for resilient mode: %s', type, JSON.stringify(redisParams));
          require('ewd-qoper8-redis')(this, redisParams);
          return;
        }
        require('ewd-qoper8-' + type)(this, db.params);
      }
    }
  });

  q.on('started', function() {
    if (!this.userDefined) this.userDefined = {};
    this.userDefined.config = config;

    var q = this;
    var io;
    var server;

    function startServer() {
      if (!config.ssl) {
        debug('starting http server');
        server = app.listen(config.port);
      }
      else {
        debug('starting https server');
        debug('cwd: %s', process.cwd());

        var https = require('https');
        var options = {
          key: fs.readFileSync(config.ssl.keyFilePath),
          cert: fs.readFileSync(config.ssl.certFilePath)
        };
        server = https.createServer(options, app).listen(config.port);
      }

      if (!config.no_sockets) {
        debug('starting web sockets');
        debug('config.webSockets: %s', JSON.stringify(config.webSockets));

        // currently only socket.io supported for WebSockets
        if (!config.webSockets.module) config.webSockets.module = 'socket.io';
        if (config.webSockets.module === 'socket.io') {
          if (!config.webSockets.engine) {
            io = require('socket.io')(server, {wsEngine: 'ws'});
          }
          else {
            var engine = config.webSockets.engine;
            if (engine !== 'ws' && engine !== 'uws') engine = 'ws';
            io = require('socket.io')(server, {wsEngine: engine});
          }
        }
      }

      // load QEWD socket handling logic
      if (io) sockets(q, io, config.customSocketModule);

      /*eslint-disable no-console*/
      console.log('========================================================');
      console.log('QEWD.js is listening on port ' + config.port);
      console.log('========================================================');
      /*eslint-enable no-console*/

      q.on('response', function(messageObj) {
        debug('messageObj: %s', JSON.stringify(messageObj));
        // handle intermediate messages from worker (which hasn't finished)
        if (messageObj.socketId) {
          debug('master on response sending message to %s', messageObj.socketId);
          var id = messageObj.socketId;
          delete messageObj.socketId;
          delete messageObj.finished;
          io.to(id).emit('ewdjs', messageObj);
        }
      });
    }

    if (config.poolPrefork) {
      var workersStarted = 0;
      debug('pool preforking');

      q.on('workerStarted', function(workerPid, customQueue) {
        debug('worker started, pid: %s', workerPid);
        var worker = q.worker.process[workerPid];
        // put worker on hold until server is started (resilientmode)
        // this requires that "workerProcessStarted" event is emitted synchronously after setting worker.isAvailable = true; in ewd-qoper8 startWorker
        // so we set worker immediately unavailable again here until all workers and the server have started
        if (worker) { worker.isAvailable = false; }
        workersStarted++;
        if (workersStarted === q.worker.poolSize) {
          // start server
          startServer();
          // now set all workers available

          /*eslint-disable guard-for-in*/
          for (var pid in q.worker.process) {
            worker = q.worker.process[pid];
            worker.isAvailable = true;
          }
          /*eslint-enable guard-for-in*/

          // start processing the queue immediately
          if (customQueue || q.queue.length > 0) q.processQueue(customQueue);
        }
      });

      // prefork all child processes in worker pool
      for (var i = 0; i < q.worker.poolSize; i++) {
        q.startWorker();
      }
    }
    else {
      startServer();
    }
  });

  debug('start ewd-qoper');
  q.start();

  return q;
}

function intercept() {
  return {
    app: app,
    q: q,
    qx: qx
  };
}

module.exports = {
  intercept: intercept,
  start: start
};

