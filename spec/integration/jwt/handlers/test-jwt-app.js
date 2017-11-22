'use strict';

module.exports = {

  handlers: {
    test: function (messageObj, session, send, finished) {
      const incomingText = messageObj.params.text;

      finished({
        text: `You sent: ${incomingText}`
      });
    }
  }

};
