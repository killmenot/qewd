'use strict';

const path = require('path');
const async = require('async');
const isJWT = require('is-jwt');
const request = require('supertest')('http://localhost:8080');
const utils = require('../utils');
const MICROSERVICES_STARTED_TIMEOUT = process.env.MICROSERVICES_STARTED_TIMEOUT;

describe('integration/qewd/microservices:', () => {
  let cps;
  let token;

  beforeAll((done) => {
    const tasks = ['login-ms', 'stock-list-ms', 'primary'];
    const iteratee = (task, cb) => {
      const options = {
        cwd: path.join(__dirname, task)
      };
      const cp = utils.fork('./qewd', options, () => cb(null, cp));
    };

    async.mapSeries(tasks, iteratee, (err, results) => {
      if (err) return done.fail(err);

      cps = results;
      setTimeout(done, MICROSERVICES_STARTED_TIMEOUT);
    });
  });

  afterAll((done) => {
    const iteratee = (cp, cb) => utils.exit(cp, cb);
    async.each(cps, iteratee, err => err ? done.fail(err) : done());
  });

  beforeEach((done) => {
    request.
      post('/api/login').
      send({
        username: 'rob',
        password: 'secret'
      }).
      expect(res => token = res.body.token).
      end(err => err ? done.fail(err) : done());
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

  describe('GET /api/info', () => {
    it('should be able to do request to local handlers and return data', (done) => {
      request.
        get('/api/info').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            info: {
              server: 'primary-server',
              loggedInAs: 'rob'
            },
            token: jasmine.any(String)
          });
          expect(isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/patient/:patientId/demographics', () => {
    it('should be able to do request to micro service return data', (done) => {
      request.
        get('/api/patient/123457/demographics').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            firstName: 'Jane',
            lastName: 'Smith',
            gender: 'Female',
            country: 'USA',
            token: jasmine.any(String)
          });
          expect(isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/:destination/stocklist', () => {
    it('should be able to do request to micro service return data', (done) => {
      request.
        get('/api/store/store1/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            store: 'store1',
            ip: '127.0.0.1:8082',
            stock: 'stock list here...',
            token: jasmine.any(String)
          });
          expect(isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
