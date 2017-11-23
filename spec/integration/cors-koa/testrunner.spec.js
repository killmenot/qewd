'use strict';

const request = require('supertest')('http://localhost:8080');
const utils = require('../utils');

describe('integration/qewd/cors-koa:', () => {
  let cp;

  const options = {
    cwd: __dirname
  };

  beforeAll((done) => {
    cp = utils.fork('./qewd', options, done);
  });

  afterAll((done) => {
    utils.exit(cp, done);
  });

  it('should be able to expose CORS headers', (done) => {
    request.
      get('/').
      expect(200).
      expect(res => {
        expect(res.headers['access-control-allow-credentials']).toBe('true');
        expect(res.headers['access-control-allow-headers']).toBe('DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization');
        expect(res.headers['access-control-allow-methods']).toBe('GET, PUT, DELETE, POST, OPTIONS');
        expect(res.headers['access-control-allow-origin']).toBe('*');
      }).
      end(err => err ? done.fail(err) : done());
  });
});
