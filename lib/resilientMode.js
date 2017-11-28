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

  3 January 2017

*/

var debug = require('debug')('qewd:resilientMode');

function storeIncomingMessage(message) {
  // first, create a timestamp index for this message
  var time = process.hrtime();
  var ix = time[0] * 1e9 + time[1];
  ix = new Date().getTime() + '-' + ix;

  var glo = {
    global: this.resilientMode.documentName,
    subscripts: ['message', ix, 'content'],
    data: JSON.stringify(message)
  };
  this.db.set(glo, function() {});

  glo = {
    global: this.resilientMode.documentName,
    subscripts: ['message', ix, 'token'],
    data: message.token
  };
  this.db.set(glo, function() {});

  glo = {
    global: this.resilientMode.documentName,
    subscripts: ['pending', message.token, ix],
    data: ''
  };
  this.db.set(glo, function() {});

  return ix;
}

function nextValue(glo, callback) {
  debug('nextValue for %s', JSON.stringify(glo));
  this.db.order(glo, function(error, result) {
    debug('nextValue -  result: %s', JSON.stringify(result));
    if (!error && callback) callback(result);
  });
}

function requeueMessages(token, ix, handleMessage) {
  var ewdQueueDocument = this.resilientMode.documentName;

  // put any pending messages with this token back onto the queue

  var q = this;
  var pendingGlo = {
    global: ewdQueueDocument,
    subscripts: ['pending', token, '']
  };

  debug('pendingGlo: %s', JSON.stringify(pendingGlo));

  var callback = function(node) {
    debug('callback; ix = %s; node = %s', ix, JSON.stringify(node));

    var dbIndex = node.result;
    if (dbIndex !== '') {
      // ignore the current latest active pending record
      if (dbIndex !== ix) {
        var glo = {
          global: ewdQueueDocument,
          subscripts: ['message', dbIndex, 'content']
        };
        q.db.get(glo, function(error, result) {
          if (result.defined) {
            var message = JSON.parse(result.data);
            if (message.type !== 'ewd-register' && message.type !== 'ewd-reregister') {
              debug('adding message %s back to queue', result.data);

              // if message had been being processed by a worker but hadn't completed
              // then flag as a re-submission

              var glo = {
                global: ewdQueueDocument,
                subscripts: ['message', dbIndex, 'workerStatus']
              };
              q.db.get(glo, function(error, result) {
                if (result.defined && result.data === 'started') {
                  message.resubmitted = true;
                }

                // put back the message onto the queue
                handleMessage(message);

                // repeat the process for the next pending record
                nextValue.call(q, node, callback);
              });
            }
          }
        });

        // delete the pending record
        q.db.kill(node, function() {});
      }
      else {
        nextValue.call(q, node, callback);
      }
    }
    // no more pending records, so finish
  };

  // start the loop through the pending messages for this token
  debug('Checking to see if any messages need re-queueing');
  nextValue.call(this, pendingGlo, callback);
}

function storeResponse(resultObj, token, ix, count, handleMessage) {
  if (resultObj.type === 'ewd-reregister') {
    // re-queue any pending messages for this token
    requeueMessages.call(this, token, ix, handleMessage);
  }
  // save the response to database
  saveResponse.call(this, ix, count, JSON.stringify(resultObj));
  if (resultObj.finished) {
    // remove the "pending" index record
    removePendingIndex.call(this, token, ix);
  }
}

function saveResponse(ix, count, data) {
  //console.log('saveResponse: ix = ' + ix + '; count: ' + count + '; data = ' + data);
  var glo = {
    global: this.resilientMode.documentName,
    subscripts: ['message', ix, 'response', count],
    data: data
  };
  this.db.set(glo, function() {});
}

function removePendingIndex(token, ix) {
  var glo = {
    global: this.resilientMode.documentName,
    subscripts: ['pending', token, ix]
  };
  var q = this;
  setTimeout(function() {
    // delay it a bit to ensure this happens after the pending index is saved
    q.db.kill(glo, function() {});
  }, 1000);
}

function storeWorkerStatusUpdate(messageObj, status) {
  var queueStore = new this.documentStore.DocumentNode(this.userDefined.config.resilientMode.documentName, ['message', messageObj.dbIndex, 'workerStatus']);
  queueStore.value = status;
}

function cleardownQueueBackup() {
  var queue = new this.documentStore.DocumentNode(this.userDefined.config.resilientMode.documentName);
  var messages = queue.$('message');
  var pending = queue.$('pending');

  var now = new Date().getTime();
  var diff = this.userDefined.config.resilientMode.keepPeriod;
  diff = diff * 1000;
  var cutOff = now - diff;

  debug('%s: Clearing down queue backup document, up to %s seconds ago', process.pid, (diff /1000));

  messages.forEachChild(function(dbIndex, messageObj) {
    var timestamp = parseInt(dbIndex.split('-')[0], 10);
    if (timestamp < cutOff) {
      var token = messageObj.$('token').value;
      if (!pending.$(token).$(timestamp).exists) {
        messageObj.delete();
        debug('%s: %s deleted', process.pid, dbIndex);
      }
    }
    else {
      return true; // cutoff reached, so stop checking the queue backup document
    }
  });

  debug('%s: Queue backup document cleared down', process.pid);
}

function garbageCollector(delay) {
  var q = this;
  delay = delay * 1000 || 300000; // every 5 minutes
  var garbageCollector;

  this.on('stop', function() {
    clearInterval(garbageCollector);
    /*eslint-disable no-console*/
    console.log('Queue Backup Garbage Collector has stopped');
    /*eslint-enable no-console*/
  });

  garbageCollector = setInterval(function() {
    cleardownQueueBackup.call(q);
  }, delay);

  /*eslint-disable no-console*/
  console.log('Queue Backup Garbage Collector has started in worker %s',  process.pid);
  /*eslint-enable no-console*/
}

module.exports = {
  storeResponse: storeResponse,
  storeIncomingMessage: storeIncomingMessage,
  storeWorkerStatusUpdate: storeWorkerStatusUpdate,
  garbageCollector: garbageCollector
};
