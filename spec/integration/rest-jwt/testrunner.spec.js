'use strict';

const isJWT = require('is-jwt');
const request = require('supertest')('http://localhost:8080');
const utils = require('../utils');

describe('integration/qewd/rest-jwt:', () => {
  let cp;
  let token;

  const options = {
    cwd: __dirname
  };

  beforeAll((done) => {
    cp = utils.fork('./qewd', options, done);
  });

  beforeAll((done) => {
    request.
      post('/api/login').
      send({
        username: 'rob',
        password: 'secret'
      }).
      end((err, res) => {
        if (err) return done.fail(err);

        token = res.body.token;

        done();
      });
  });

  afterAll((done) => {
    utils.exit(cp, done);
  });

  describe('POST /api/login', () => {
    it('should be able to return jwt', (done) => {
      const data = {
        username: 'rob',
        password: 'secret'
      };

      request.
        post('/api/login').
        send(data).
        expect(200).
        expect(res => {
          expect(isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/search', () => {
    it('should be able to make request using jwt', (done) => {
      request.
        get('/api/search').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            test: 'finished ok',
            username: 'rob',
            token: jasmine.any(String)
          });
          expect(isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/not-exist', () => {
    it('should be able to return 404 not found', (done) => {
      request.
        get('/api/not-exist').
        set('authorization', `Bearer ${token}`).
        expect(404).
        expect(res => {
          expect(res.body).toEqual({
            error: 'Resource Not Found'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

});
