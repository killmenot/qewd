'use strict';

const router = require('qewd-router');
const debug = require('debug')('qewd:integration:rest');

function search(args, finished) {
  finished({
    test: 'finished ok',
    username: args.session.data.$('username').value
  });
}

function login(args, finished) {
  const username = args.req.body.username || '';
  const password = args.req.body.password || '';

  if (username !== 'rob' && password !== 'secret') {
    return finished({error: 'Invalid credentials'});
  }

  const session = this.sessions.create('testWebService', 3600);
  session.authenticated = true;
  session.data.$('username').value = username;

  return finished({token: session.token});
}

module.exports = {
  restModule: true,

  beforeHandler: function (req, finished) {
    if (req.path !== '/api/login') {
      return this.sessions.authenticateRestRequest(req, finished);
    }
  },

  afterHandler: function (req) {
    debug('%s %s', req.method, req.path);
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
