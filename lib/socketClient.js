/*

 ----------------------------------------------------------------------------
 | qewd: Quick and Easy Web Development                                     |
 |                                                                          |
 | Copyright (c) 2017-18 M/Gateway Developments Ltd,                        |
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

  21 March 2018

*/

var events = require('events');
var io = require('socket.io-client');
var jwtHandler = require('./jwtHandler');
var debug = require('debug')('qewd:socketClient');

var ms_response_handlers = {};

function start(params) {
  debug('start: %s', JSON.stringify(params));

  var self = this;

  this.application = params.application || 'undefined';
  this.url = params.url || false;
  this.log = params.log || false;
  this.jwt = params.jwt || false;
  this.connected = false;
  if (!this.url) return;
  this.hasEventHandler = {};

  var socket = io(this.url, {transports: ['websocket']});

  this.on('error', function(message) {
    debug('error: %s', JSON.stringify(message));
  });

  function handleResponse(messageObj) {
    var id;

    // messages received back from socket server

    if (messageObj.type === 'ewd-register') {
      debug('application %s registered', self.application);
      self.token = messageObj.message.token;
      self.emit('ewd-registered');
      return;
    }

    if (messageObj.type === 'ewd-reregister') {
      debug('application re-registered', self.application);
      self.emit('ewd-reregistered');
      return;
    }

    debug('received: %s',  JSON.stringify(messageObj));

    if (messageObj.type === 'error' && typeof messageObj.message === 'string') {

      // This will be a response from a MicroService that has had an unexpected exception
      //  As such, it won't have been able to return the MicroService request Id
      //  so the master process won't be able to link it to the Express / Koa response object
      //  The error response therefore can't be returned to the client that made the request

      messageObj = {
        message: {
          error: messageObj.message
        }
      };
    }

    if (messageObj.message && messageObj.message.error) {
      // for MicroService responses, get response handler from the hash and execute it
      if (messageObj.message.ms_requestId && ms_response_handlers[messageObj.message.ms_requestId]) {
        id = +messageObj.message.ms_requestId;
        delete messageObj.message.ms_requestId;
        ms_response_handlers[id](messageObj);
        delete ms_response_handlers[id];
      }
      else {
        debug('emitting error as rest request: %j', messageObj);
        self.emit('restRequest', messageObj);
      }

      return;
    }

    // for MicroService responses, get response handler from the hash and execute it
    if (messageObj.message.ms_requestId && ms_response_handlers[messageObj.message.ms_requestId]) {
      id = +messageObj.message.ms_requestId;
      delete messageObj.message.ms_requestId;
      ms_response_handlers[id](messageObj);
      delete ms_response_handlers[id];
    }
    else {
      debug('emiting event: %s', messageObj.type);
      self.emit(messageObj.type, messageObj);
    }
  }

  socket.on('connect', function() {
    var message;

    self.disconnectSocket = function() {
      socket.disconnect();
      debug('disconnected socket');
    };

    if (self.token) {
      // re-connection occured - re-register to attach to original Session
      // need to update JWT expiry to ensure it re-connects OK

      debug('reregistering with secret: %s', self.jwt.secret);
      self.token = jwtHandler.updateJWTExpiry.call(self, self.token);

      message = {
        type: 'ewd-reregister',
        token: self.token
      };
      if (self.jwt) message.jwt = true;
    }
    else {
      debug('registering application: %s', self.application);

      message = {
        type: 'ewd-register',
        application: self.application
      };
      if (self.jwt) message.jwt = true;
    }

    self.connected = true;
    socket.emit('ewdjs', message);
  });

  socket.on('ewdjs', handleResponse);

  this.addHandler = function(type, callback) {
    this.on(type, callback);
    this.hasEventHandler[type] = callback;
  };

  this.sub = this.addHandler;

  this.removeHandler = function(type) {
    var callback = this.hasEventHandler[type];
    this.removeListener(type, callback);
    this.hasEventHandler[type] = false;
  };

  this.send = function(messageObj, callback) {
    if (!this.connected) {
      return callback({
        error: 'MicroService connection is down',
        status: {
          code: 503
        }
      });
    }

    var type = messageObj.type;
    if (callback) {
      if (messageObj.ms_requestId) {
        // add the response handler to the microService handler hash
        ms_response_handlers[messageObj.ms_requestId] = callback;
        //self.once(messageObj.uuid, callback);
        debug('callback response handler saved for message %d', messageObj.ms_requestId);
      }
      else {
        if (this.hasEventHandler[type] && callback !== this.hasEventHandler[type]) {
          debug('callback has changed for type: %s ', type);
          this.removeHandler(type);
        }

        if (!this.hasEventHandler[type]) {
          debug('callback set for type: %s', type);
          this.addHandler(type, callback);
        }
      }
    }

    socket.emit('ewdjs', messageObj);
    debug('sent: ' + JSON.stringify(messageObj));
  };

  socket.on('disconnect', function() {
    debug('server has disconnected socket, probably because it shut down');
    self.connected = false;
    self.emit('socketDisconnected');
  });
}

var SocketClient = function() {
  this.application = 'undefined';
  this.log = false;
  this.token = false;
  events.EventEmitter.call(this);
};

var proto = SocketClient.prototype;
proto.__proto__ = events.EventEmitter.prototype;
proto.start = start;

module.exports = SocketClient;
