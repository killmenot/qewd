'use strict';

const router = require('qewd-router');

function info(args, finished) {
  args.session.ranInfoAt = Date.now();
  const username = args.session.username;
  const jwt = this.jwt.handlers.setJWT.call(this, args.session);

  finished({
    info: {
      server: 'primary-server',
      loggedInAs: username
    },
    token: jwt
  });
}

module.exports = {
  restModule: true,

  beforeHandler: function (req, finished) {
    return this.jwt.handlers.validateRestRequest.call(this, req, finished);
  },

  init: function (application) {
    const routes = [
      {
        url: '/api/info',
        method: 'GET',
        handler: info
      }
    ];

    router.initialise(routes, module.exports);
    router.setErrorResponse(404, 'Not Found');
    this.setCustomErrorResponse.call(this, {
      application: application,
      errorType: 'noTypeHandler',
      text: 'Resource Not Found',
      statusCode: '404'
    });
  }
};
