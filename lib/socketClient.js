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

function start(params) {

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
  });

  function handleResponse(messageObj) {
    // messages received back from socket server

    /*

    don't disconnect a QEWD socket connection!

    if (messageObj.message && messageObj.message.error && messageObj.message.disconnect) {
      if (typeof socket !== 'undefined') {
        socket.disconnect();
        console.log('Socket disconnected');
      }
      return;
    }
    */

    if (messageObj.type === 'ewd-register') {
      self.token = messageObj.message.token;
      console.log(self.application + ' registered');
      self.emit('ewd-registered');
      return;
    }

    if (messageObj.type === 'ewd-reregister') {
      console.log('Re-registered');
      self.emit('ewd-reregistered');
      return;
    }

    if (self.log) console.log('received: ' + JSON.stringify(messageObj));

    if (messageObj.message && messageObj.message.error) {
      var ok = self.emit('restRequest', messageObj);
      return;
      //if (ok) return;
    }

    //console.log('messageObj.type: ' + messageObj.type);
    self.emit(messageObj.type, messageObj);
  }

  socket.on('connect', function() {

    self.disconnectSocket = function() {
      socket.disconnect();
      console.log('qewd-socketClient disconnected socket');
    };
    var message;
    if (self.token) {
      // re-connection occured - re-register to attach to original Session
      // need to update JWT expiry to ensure it re-connects OK

     console.log('*** socketClient re-register - secret = ' + self.jwt.secret);

      self.token = jwtHandler.updateJWTExpiry.call(self, self.token)

      message = {
        type: 'ewd-reregister',
        token: self.token
      };
      if (self.jwt) message.jwt = true;
    }
    else {
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
        console.log('callback has changed for type ' + type);
        this.removeHandler(type);
      }
      if (!this.hasEventHandler[type]) {
        this.addHandler(type, callback);
        console.log('callback set for type ' + type);
      }
    }
    /*
    if (self.token) {
      messageObj.token = self.token;
      socket.emit('ewdjs', messageObj);
      if (self.log) console.log('sent: ' + JSON.stringify(messageObj));
    }
    */
    socket.emit('ewdjs', messageObj);
    if (this.log) console.log('sent: ' + JSON.stringify(messageObj));
  };

  socket.on('disconnect', function() {
    console.log('*** server has disconnected socket, probably because it shut down');
    self.connected = false;
    self.emit('socketDisconnected');
  });

}

var socketClient = function() {

  this.application = 'undefined';
  this.log = false;
  this.token = false;
  events.EventEmitter.call(this);
};

var proto = socketClient.prototype;
proto.__proto__ = events.EventEmitter.prototype;
proto.start = start;

module.exports = socketClient;
