/*

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

  6 September 2017

*/

var events = require('events');
var io = require('socket.io-client');
var jwtHandler = require('./jwtHandler');
var debug = require('debug')('qewd:socketClient');

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

    if (messageObj.message && messageObj.message.error) {
      debug('rest request');
      self.emit('restRequest', messageObj);
      return;
    }

    debug('emiting type: %s', messageObj.type);
    self.emit(messageObj.type, messageObj);
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
      callback({
        error: 'MicroService connection is down',
        status: {
          code: 503
        }
      });
      return;
    }

    var type = messageObj.type;
    if (callback) {
      if (this.hasEventHandler[type] && callback !== this.hasEventHandler[type]) {
        debug('callback has changed for type: %s ', type);
        this.removeHandler(type);
      }
      if (!this.hasEventHandler[type]) {
        debug('callback set for type: %s', type);
        this.addHandler(type, callback);
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
