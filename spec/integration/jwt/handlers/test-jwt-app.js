'use strict';

const debug = require('debug')('qewd:integration:jwt');

module.exports = {

  afterHandler: function (messageObj) {
    debug('type: %s, use jwt: %s', messageObj.type, messageObj.jwt ? 'yes' : 'no');
  },

  handlers: {
    test: function (messageObj, session, send, finished) {
      finished({
        text: `You sent: ${messageObj.params.text}`
      });
    }
  }

};
