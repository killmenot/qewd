'use strict';

const router = require('qewd-router');

function search(args, finished) {
  finished({
    text: 'Hello handlers!'
  });
}

module.exports = {
  restModule: true,

  init: function () {
    const routes = [
      {
        url: '/api/search',
        method: 'GET',
        handler: search
      },
    ];

    router.initialise(routes, module.exports);
  }
};
