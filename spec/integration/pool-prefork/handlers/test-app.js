'use strict';

module.exports = {

  handlers: {
    test: function (messageObj, session, send, finished) {
      finished({
        text: `You sent: ${messageObj.params.text}`
      });
    }
  }

};
