'use strict';

module.exports = {

  handlers: {
    test: function (messageObj, session, send, finished) {
      send({
        text: 'You sent intermediate message'
      });

      setTimeout(() => {
        finished({
          text: `You sent: ${messageObj.params.text}`
        });
      }, 500);
    }
  }

};
