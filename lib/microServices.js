/*

 ----------------------------------------------------------------------------
 | qewd: Quick and Easy Web Development                                     |
 |                                                                          |
 | Copyright (c) 2017-18 M/Gateway Developments Ltd,                           |
 | Redhill, Surrey UK.                                                      |
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

  31 January 2018

  Run during master process startup (see master.js)
  Sets up MicroService connections and control data structues
  as defined in the QEWD startup file

*/

var QewdSocketClient = require('./socketClient');
var router = require('qewd-router');
var debug = require('debug')('qewd:microServices');

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function logRoute(route) {
  var obj = clone(route);

  if (obj.route && obj.route.ast) {
    delete obj.route.ast;
  }

  return obj;
}

function addClient(url, application, startParams) {
  var q = this;

  debug('adding MicroService Client connection: url: %s; application: %s', url, application);

  if (!this.u_services.clients[url]) {
    this.u_services.clients[url] = new QewdSocketClient();
    startParams[url] = {
      url: url,
      application: application,
      log: true,
      jwt: this.jwt
    };

    this.u_services.clients[url].on('ewd-registered', function() {
      debug('%s micro-service ready', url);

      // save registration token (needed for REST micro-service paths
      q.u_services.clients[url].token = this.token;
    });
  }

  return this.u_services.clients[url];
}

module.exports = function(services_config) {
  debug('Setting up micro-service connections');

  // set up micro-service connections
  var startParams = {};
  var client;
  var q = this;

  this.u_services = {
    clients: {},
    byApplication: {},
    byPath: {},
    restRoutes: [],
    byDestination: {}
  };

  if (!services_config.destinations && !services_config.routes) {
    // clone the routes array
    var routes = services_config.slice(0);

    services_config = {
      destinations: {},
      routes: routes
    };
  }

  /*eslint-disable guard-for-in*/
  for (var destination in services_config.destinations) {
    var destObj = services_config.destinations[destination];
    if (destObj.application && destObj.host) {
      client = addClient.call(q, destObj.host, destObj.application, startParams);
      destObj.client = client;
    }
    q.u_services.byDestination[destination] = destObj;
  }
  /*eslint-enable guard-for-in*/

  services_config.routes.forEach(function(service) {
    var path = service.path;

    debug('route config: %j', service);

    if (path) {
      // Rest Microservice routes - we'll handle these using qewd-router
      debug('REST Microservice route');

      var route = {
        pathTemplate: path,
        destination: service.destination,
        method: service.method,
        route: new router.routeParser(service.path) // eslint-disable-line new-cap
      };

      if (service.bypassJWTCheck) {
        debug('configure route.bypassJWTCheck');
        route.bypassJWTCheck = service.bypassJWTCheck;
      }

      if (service.onResponse) {
        debug('configure route.onResponse');
        route.onResponse = service.onResponse;
      }

      if (service.onRequest) {
        debug('configure route.onRequest');
        route.onRequest = service.onRequest;
        delete route.destination; // onRequest function will determine the destination
        delete route.onResponse;  // onRequest's responsibility is to route to a destination which may have an onResponse
      }

      debug('rest route: %j', logRoute(route));

      q.u_services.restRoutes.push(route);

      // make qewd-router accessible to ewd-qoper8-express which will handle the run-time routing
      if (!q.router) q.router = router;
    }
    else {
      // QEWD WebSocket Application MicroService routes
      debug('QEWD WebSocket Application MicroService route');

      var application = service.application;

      if (application && !q.u_services.byApplication[application]) {
        q.u_services.byApplication[application] = {};
      }

      /*eslint-disable guard-for-in*/
      for (var type in service.types) {
        var serviceType = service.types[type];

        debug('type: %s', type);
        debug('serviceType: %s', serviceType);

        // route defined with host url and application, or with destination
        if (serviceType.url && serviceType.application) {
          debug('route defined with host url and application');
          client = addClient.call(q, serviceType.url, serviceType.application, startParams);
          q.u_services.byApplication[application][type] = {
            application: serviceType.application,
            type: type,
            client: client
          };
        }
        else if (serviceType.destination && services_config.destinations[serviceType.destination]) {
          debug('route defined with destination');
          client = q.u_services.clients[services_config.destinations[serviceType.destination].host];
          q.u_services.byApplication[application][type] = {
            application: services_config.destinations[serviceType.destination].application,
            type: type,
            client: client
          };
        }
      }
      /*eslint-enable guard-for-in*/
    }
  });

  // now start up the socket connections to the remote micro-socket servers
  // only when these connections are in place will this QEWD instance start

  /*eslint-disable guard-for-in*/
  for (var url in this.u_services.clients) {
    debug('starting microService connection to %s', url);
    this.u_services.clients[url].start(startParams[url]);
  }
  /*eslint-enable guard-for-in*/

  debug('u_services by application: %j', q.u_services.byApplication);

};
