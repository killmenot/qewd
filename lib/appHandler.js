/*!

 ----------------------------------------------------------------------------
 | qewd: Quick and Easy Web Development                                     |
 |                                                                          |
 | Copyright (c) 2017 M/Gateway Developments Ltd,                           |
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

  31 August 2017

*/

var getFragment = require('./getFragment');
var resilientMode = require('./resilientMode');
var handleJWT = require('./jwtHandler');

var MODULE_LOAD_ERROR = 'moduleLoadError';
var NO_DOCUMENT_STORE = 'noDocumentStore';
var NO_TYPE_HANDLER = 'noTypeHandler';
var SESSION_NOT_AUTHENTICATED = 'sessionNotAuthenticated';
var NO_SERVICE_MODULE_TYPE = 'noServiceModuleType';
var SERVICE_NOT_ALLOWED = 'serviceNotAllowed';
var SERVICE_NOT_ALLOWED_FOR_USER = 'serviceNotAllowedForUser';

function loadModule(application, finished) {
  try {
    var moduleName = application;
    if (this.userDefined.config.moduleMap && this.userDefined.config.moduleMap[application]) {
      moduleName = this.userDefined.config.moduleMap[application];
    }

    var appModule = require(moduleName);

    if (!appModule.handlers) appModule.handlers = {};

    if (appModule.handlers) this.handlers[application] = appModule.handlers;
    if (appModule.beforeHandler) {
      this.beforeHandlers[application] = appModule.beforeHandler;
    }
    if (appModule.beforeMicroServiceHandler) {
      var q = this;
      this.beforeHandlers[application] = function(messageObj, session, send, finished) {
        return appModule.beforeMicroServiceHandler.call(q, messageObj, finished);
      };
    }
    if (appModule.afterHandler) {
      this.afterHandlers[application] = appModule.afterHandler;
    }
    if (appModule.servicesAllowed) this.servicesAllowed[application] = appModule.servicesAllowed;
    if (appModule.restModule === true) this.restModule[application] = true;
    // provide an initialisation point to load stuff like documentStore event handlers for indexing
    if (appModule.init && typeof appModule.init === 'function') appModule.init.call(this, application);
    console.log('loadModule: handler module loaded for application ' + application + '; module: ' + moduleName);
    return true;
  }
  catch(err) {
    var error = 'Unable to load handler module for: ' + application;
    if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][MODULE_LOAD_ERROR]) {
      error = this.errorMessages[application][MODULE_LOAD_ERROR];
    }
    console.log(error + ': ' + err);
    finished({
      error: error,
      reason: err
    });
    return false;
  }
}

function customError(errorObj) {
  var error;
  if (typeof errorObj === 'string') {
    error = {error: errorObj};
  }
  else {
    error = {
      error: errorObj.text,
      status: {
        code: errorObj.statusCode
      }
    };
  }
  return error;
}

module.exports = function() {

  this.on('message', function(messageObj, sendFn, finishedFn) {

    var q = this;
    var send = sendFn;
    var finished = finishedFn;
    var type = messageObj.type;
    var application = messageObj.application;

    var error;
    var session;
    var result;
    var status;
    var ok;
    var finalise;

    if (this.userDefined.config.resilientMode && messageObj.dbIndex) {
      // create special version of finished function to log worker processing progress
      finished = function(responseObj) {
        if (responseObj.error) {
          resilientMode.storeWorkerStatusUpdate.call(q, messageObj, 'error');
        }
        else {
          resilientMode.storeWorkerStatusUpdate.call(q, messageObj, 'finished');
        }
        finishedFn(responseObj);
      };
      resilientMode.storeWorkerStatusUpdate.call(q, messageObj, 'started');
    }

    if (!this.documentStore) {
      error = {error: 'No Document Store has been created - you must use ewd-document-store!'};
      if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][NO_DOCUMENT_STORE]) {
        error = customError(this.errorMessages[application][NO_DOCUMENT_STORE]);
      }

      return finished(error);
    }

    if (type === 'ewd-jwt-decode') {
      // used by QEWD sockets.js module to decode JWT
      var payload = handleJWT.decodeJWT.call(this, messageObj.params.jwt);
      return finished(payload);
    }

    if (type === 'ewd-jwt-encode') {
      // used by QEWD sockets.js module to encode JWT
      var jwt = handleJWT.encodeJWT.call(this, messageObj.params.payload);
      return finished({jwt: jwt});
    }

    if (type === 'ewd-jwt-updateExpiry') {
      // used by ewd-qoper8-express MicroService Router to update JWT
      var token = handleJWT.updateJWTExpiry.call(this, messageObj.params.jwt, messageObj.params.application);
      return finished({jwt: token});
    }

    if (type === 'ewd-jwt-isValid') {
      // used by ewd-qoper8-express MicroService Router to validate JWT
      status = handleJWT.isJWTValid.call(this, messageObj.params.jwt);
      return finished(status);
    }

    if (type === 'ewd-qoper8-express') {

      if (messageObj.headers && messageObj.headers.qewd && messageObj.headers.qewd === 'ajax') {
        // this must be an ewd-xpress message sent over Ajax
        var ip = messageObj.ip;
        var ips = messageObj.ips;
        messageObj = messageObj.body;
        type = messageObj.type;
        if (type === 'ewd-register') {
          messageObj.ipAddress = ip;
        }
        messageObj.ip = ip;
        messageObj.ips = ips;
        // can't use the send() function over Ajax so disable it to prevent a server-side crash
        send = function(msg) {
          console.log('** Unable to use send() function over Ajax for intermediate message ' + JSON.stringify(msg));
        };
      }
      else if (messageObj.expressType) {
        type = messageObj.expressType;
      }

      if (messageObj.application) {
        application = messageObj.application;
        if (!this.restModule) this.restModule = {};

        if (!this.handlers[application]) {
          ok = loadModule.call(this, application, finished);
          if (!ok) return;
        }

        // If this is defined as a rest application, invoke its type handler now
        if (this.restModule[application]) {
          if (this.handlers[application][type]) {
            finalise = function(results) {
              results = results || {};
              results.restMessage = true;
              //results.type = type;
              results.ewd_application = application;
              finished(results);
            };

            if (this.jwt && typeof this.jwt.handlers !== 'function') {
              this.jwt.handlers = handleJWT;
            }

            if (this.beforeHandlers[application]) {
              status = this.beforeHandlers[application].call(this, messageObj, finalise);
              if (status === false) return;
            }

            // invoke the handler for this message
            this.handlers[application][type].call(this, messageObj, finalise);

            if (this.afterHandlers[application]) {
              this.afterHandlers[application].call(this, messageObj, finalise);
            }

            return;
          }

          error = {error: 'No handler defined for ' + application + ' messages of type ' + type};
          if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][NO_TYPE_HANDLER]) {
            error = customError(this.errorMessages[application][NO_TYPE_HANDLER]);
          }

          return finished(error);
        }
      }

      console.log('ewd-qoper8-express message remapped to: type ' + type + ': ' + JSON.stringify(messageObj));
    }

    if (type === 'ewd-register') {
      // register a new application user
      if (messageObj.jwt) {
        return finished(handleJWT.register.call(this, messageObj));
      }

      var params = {
        application: messageObj.application,
        timeout: this.userDefined.config.initialSessionTimeout
      };
      session = this.sessions.create(params);
      if (messageObj.socketId) session.socketId = messageObj.socketId;
      if (messageObj.ipAddress) session.ipAddress = messageObj.ipAddress;

      return finished({token: session.token});
    }

    if (messageObj.jwt) {
      result = handleJWT.validate.call(this, messageObj);
    }
    else {
      result = this.sessions.authenticate(messageObj.token, 'noCheck');
    }

    if (result.error) {
      error = result.error;
      if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][SESSION_NOT_AUTHENTICATED]) {
        error = this.errorMessages[application][SESSION_NOT_AUTHENTICATED];
      }

      return finished({
        error: error,
        disconnect: true
      });
    }

    session = result.session;

    if (messageObj.jwt && !session) {
      session = {};
    }

    if (type === 'ewd-reregister') {
      // update the socketId in the session to the new one
      console.log('re-register token ' + messageObj.token);
      if (messageObj.jwt) {
        result = handleJWT.reregister.call(this, session, messageObj);
      }
      else {
        if (messageObj.socketId) session.socketId = messageObj.socketId;
        if (messageObj.ipAddress) session.ipAddress = messageObj.ipAddress;
        result = {ok: true};
      }

      return finished(result);
    }

    if (!messageObj.jwt) session.updateExpiry();
    application = session.application;

    if (type === 'ewd-fragment') {
      if (messageObj.service && !this.servicesAllowed[application]) {
        ok = loadModule.call(this, application, finished);
        if (!ok) return;
      }
      getFragment.call(this, messageObj, application, finished);
      return;
    }

    // if no handlers have yet been loaded for the incoming application request
    // load them now...

    if (!this.handlers[application]) {
      ok = loadModule.call(this, application, finished);
      if (!ok) return;
    }

    // session locking - has to be specifically switched on!
    if (this.userDefined.config.lockSession) {
      var timeout = this.userDefined.config.lockSession.timeout || 30;
      this.sessionLocked = {
        global: this.userDefined.config.sessionDocumentName,
        subscripts: ['session', session.id]
      };
      console.log('*** session locked: ' + JSON.stringify(this.sessionLocked));
      ok = this.db.lock(this.sessionLocked, timeout);
      if (ok.result.toString() === '0') {
        return finished({error: 'Timed out waiting for EWD session to be released'});
      }
    }

    // is this a service request, and if so, is it allowed for this application?
    var servicesAllowed = this.servicesAllowed[application];
    var service = messageObj.service;

    if (service) {
      // this is a request for a service handler
      // first, check if the service is permitted for the user's application, and if so,
      // make sure the service handlers are loaded

      var allowService = false;
      var sessionAllowService;
      if (servicesAllowed && servicesAllowed[service]) allowService = true;
      // can be over-ridden by session-specific service allowance
      if (typeof session.allowedServices[service] !== 'undefined') {
        allowService = session.allowedServices[service];
        sessionAllowService = allowService;
      }

      ok = loadModule.call(this, service, finished);

      if (allowService) {
        if (!this.handlers[service]) {
          ok = loadModule.call(this, service, finished);
          if (!ok) return;
        }

        if (this.handlers[service][type]) {
          if (this.beforeHandlers[service]) {
            status = this.beforeHandlers[service].call(this, messageObj, session, send, finished);
            if (status === false) return;
          }

          // invoke the handler for this message
          this.handlers[service][type].call(this, messageObj, session, send, finished);

          if (this.afterHandlers[service]) {
            this.afterHandlers[service].call(this, messageObj, session, send, finished);
          }

          return;
        }

        error = 'No handler defined for ' + service + ' service messages of type ' + type;
        if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][NO_SERVICE_MODULE_TYPE]) {
          error = this.errorMessages[application][NO_SERVICE_MODULE_TYPE];
        }

        return finished({
          error: error,
          service: service
        });
      }

      error = service + ' service is not permitted for the ' + application + ' application';
      if (sessionAllowService === false) error = 'You are not allowed access to the ' + service + ' service';
      if (this.errorMessages && this.errorMessages[application]) {
        if (this.errorMessages[application][SERVICE_NOT_ALLOWED]) {
          error = this.errorMessages[application][SERVICE_NOT_ALLOWED];
        }
        if (sessionAllowService === false && this.errorMessages[application][SERVICE_NOT_ALLOWED_FOR_USER]) {
          error = this.errorMessages[application][SERVICE_NOT_ALLOWED_FOR_USER];
        }
      }

      return finished({
        error: error,
        service: service
      });
    }

    // handlers are available for this user's application
    // try to invoked the appropriate one for the incoming request

    if (this.jwt && typeof this.jwt.handlers !== 'function') {
      this.jwt.handlers = handleJWT;
    }

    if (this.handlers[application][type]) {
      finalise = function(results) {
        //console.log('*** finalise: results = ' + JSON.stringify(results));
        //console.log('*** finalise: session = ' + JSON.stringify(session));
        results = results || {};
        results.ewd_application = application;
        if (messageObj.jwt && !results.error) {
          // update the JWT as part of the response
          results.token = handleJWT.updateJWT.call(q, session);
        }
        finished(results);
      };

      if (this.beforeHandlers[application]) {
        status = this.beforeHandlers[application].call(this, messageObj, session, send, finalise);
        if (status === false) return;
      }

      // invoke the handler for this message
      this.handlers[application][type].call(this, messageObj, session, send, finalise);

      if (this.afterHandlers[application]) {
        this.afterHandlers[application].call(this, messageObj, session, send, finalise);
      }

      return;
    }

    error = {error: 'No handler defined for ' + application + ' messages of type ' + type};
    if (this.errorMessages && this.errorMessages[application] && this.errorMessages[application][NO_TYPE_HANDLER]) {
      error = customError(this.errorMessages[application][NO_TYPE_HANDLER]);
    }

    return finished(error);
  });

};
