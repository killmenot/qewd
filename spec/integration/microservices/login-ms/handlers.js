'use strict';

const router = require('qewd-router');

const patients = {
  '123456': {
    firstName: 'Rob',
    lastName: 'Tweed',
    gender: 'Male',
    country: 'UK'
  },
  '123457': {
    firstName: 'Jane',
    lastName: 'Smith',
    gender: 'Female',
    country: 'USA'
  },
};

function login(args, finished) {
  const username = args.req.body.username;
  const password = args.req.body.password;
  const session = args.session;

  if (username === 'rob' && password === 'secret') {
    session.userText = 'Welcome Rob';
    session.username = username;
    session.authenticated = true;
    session.timeout = 1200;

    session.makeSecret('username');
    session.makeSecret('authenticated');

    return finished({
      ok: true
    });
  }

  return finished({
    error: 'Invalid login'
  });
}

function getDemographics(args, finished) {
  const patientId = args.patientId;

  if (!patientId) {
    return finished({
      error: 'You must specify a patientId'});
  }

  if (!patients[patientId]) {
    return finished({
      error: 'Invalid patientId'
    });
  }

  return finished(patients[patientId]);
}

module.exports = {

  init: function () {
    const routes = {
      '/api/login': {
        POST: login
      },
      '/api/patient/:patientId/demographics': {
        GET: getDemographics
      }
    };
    router.addMicroServiceHandler(routes, module.exports);
  },

  beforeMicroServiceHandler: function (req, finished) {
    if (req.path !== '/api/login') {
      return this.jwt.handlers.validateRestRequest.call(this, req, finished);
    }
  }
};
