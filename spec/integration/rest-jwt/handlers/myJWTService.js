'use strict';

const router = require('qewd-router');

function search(args, finished) {
  args.session.ranSearchAt = Date.now();

  const username = args.session.username;
  const jwt = this.jwt.handlers.setJWT.call(this, args.session);

  finished({
    test: 'finished ok',
    username: username,
    token: jwt
  });
}

function login(args, finished) {
  const username = args.req.body.username || '';
  const password = args.req.body.password || '';

  if (username !== 'rob' || password !== 'secret') {
    return finished({error: 'Invalid credentials'});
  }

  const session = this.jwt.handlers.createRestSession.call(this, args);
  session.welcomeText = 'Welcome ' + username;
  session.username = username;
  session.makeSecret('username');
  session.authenticated = true;
  session.timeout = 1200;
  const jwt = this.jwt.handlers.setJWT.call(this, session);

  finished({token: jwt});
}

module.exports = {
  restModule: true,

  beforeHandler: function (messageObj, finished) {
    if (messageObj.path !== '/api/login') {
      return this.jwt.handlers.validateRestRequest.call(this, messageObj, finished);
    }
  },

  init: function (application) {
    const routes = [
      {
        url: '/api/search',
        method: 'GET',
        handler: search
      },
      {
        url: '/api/login',
        method: 'POST',
        handler: login
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
