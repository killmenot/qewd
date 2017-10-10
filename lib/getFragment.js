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

var path = require('path');
var fs = require('fs');
var servicePaths = {};

module.exports = function(messageObj, application, finished) {
  var fragmentName = messageObj.params.file;
  var wsRootPath = this.userDefined.config.webServerRootPath;
  var fragPath = path.join(wsRootPath, application, fragmentName);
  var service = messageObj.service;

  if (service && service !== '') {
    var servicesAllowed = this.servicesAllowed[application];
    if (servicesAllowed && servicesAllowed[service]) {
      if (!servicePaths[service]) {
        servicePaths[service] = path.dirname(require.resolve(service));
      }
      fragPath = path.join(servicePaths[service], 'fragments', fragmentName);
    }
    else {
      return finished({error: service + ' service is not permitted for the ' + application + ' application'});
    }
  }

  if (messageObj.params.isServiceFragment) {
    fragPath = path.join(wsRootPath, 'services', fragmentName);
  }

  fs.exists(fragPath, function(exists) {
    if (exists) {
      fs.readFile(fragPath, 'utf8', function(err, data) {
        if (err) {
          return finished({error: 'Unable to read file ' + fragPath});
        }

        finished({
          fragmentName: fragmentName,
          content: data
        });
      });
    }
    else {
      var message = {
        error: 'Fragment file ' +  messageObj.params.file + ' does not exist',
        file: messageObj.params.file
      };

      if (messageObj.service) {
        message.service = messageObj.service;
      }
      if (messageObj.params.isServiceFragment) {
        message.isServiceFragment = true;
      }

      finished(message);
    }
  });
};
