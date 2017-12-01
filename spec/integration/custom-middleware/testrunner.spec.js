'use strict';

const request = require('supertest')('http://localhost:8080');
const utils = require('../utils');

describe('integration/qewd/custom-middleware:', () => {
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

  describe('GET /api/search', () => {
    it('should process before router middleware', (done) => {
      request.
        get('/api/search?beforeRouter=foo').
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'Hello beforeRouter!'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });

    it('should process handlers', (done) => {
      request.
        get('/api/search').
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'Hello handlers!'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });

    it('should process after router middleware', (done) => {
      request.
        get('/api/search?afterRouter=bar').
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'Hello afterRouter!'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
