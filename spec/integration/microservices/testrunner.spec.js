'use strict';

const path = require('path');
const async = require('async');
const request = require('supertest')('http://localhost:8080');
const utils = require('../utils');

describe('integration/qewd/microservices:', () => {
  let cps;
  let token;

  beforeAll((done) => {
    const services = ['login-ms', 'stock-list-ms', 'primary'];
    const iteratee = (task, cb) => {
      const options = {
        cwd: path.join(__dirname, task)
      };
      const cp = utils.fork('./qewd', options, () => cb(null, cp));
    };

    async.mapSeries(services, iteratee, (err, results) => {
      if (err) return done.fail(err);

      cps = results;
      setTimeout(done, process.env.MICROSERVICES_STARTED_TIMEOUT);
    });
  });

  afterAll((done) => {
    const iteratee = (cp, cb) => utils.exit(cp, cb);
    async.each(cps, iteratee, err => err ? done.fail(err) : done());
  });

  beforeEach((done) => {
    const data = {
      username: 'rob',
      password: 'secret'
    };

    request.
      post('/api/login').
      send(data).
      expect(res => token = res.body.token).
      end(err => err ? done.fail(err) : done());
  });

  describe('POST /api/login', () => {
    it('should send request to login service', (done) => {
      const data = {
        username: 'rob',
        password: 'secret'
      };

      request.
        post('/api/login').
        send(data).
        expect(200).
        expect(res => {
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/info', () => {
    it('should send request to local service', (done) => {
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
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/patient/:patientId/demographics', () => {
    it('should send authenticated request to login service with params', (done) => {
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
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/all/stocklist', () => {
    it('should send request to grouped destination', (done) => {
      request.
        get('/api/store/all/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            results: {
              store1: {
                'ip': '127.0.0.1:8082',
                'stock': 'stock list here...'
              },
              store2: {
                'ip': '127.0.0.1:8082',
                'stock': 'stock list here...'
              }
            },
            token: jasmine.any(String)
          });
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/request/stocklist', () => {
    it('should send request and be intercepted by route onRequest', (done) => {
      request.
        get('/api/store/request/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'Hello from onRequest handler'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/:destination/stocklist', () => {
    it('should send request to dynamic destination', (done) => {
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
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });

    it('should send request and be intercepted by route onResponse (single destination)', (done) => {
      request.
        get('/api/store/store1/stocklist?onResponse=intercept').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            store: 'store1',
            ip: '127.0.0.1:8082',
            stock: 'stock list here...',
            text: 'The response was intercepted by onResponse handler.',
            token: jasmine.any(String)
          });
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });

    it('should send request and be handled by route onResponse (single destination)', (done) => {
      request.
        get('/api/store/store1/stocklist?onResponse=handle').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            store: 'store1',
            ip: '127.0.0.1:8082',
            stock: 'stock list here...',
            text: 'The response was handled by onResponse handler.',
            token: jasmine.any(String)
          });
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });

    it('should be able to do request with non existing destination', (done) => {
      request.
        get('/api/store/store3/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(400).
        expect(res => {
          const body = res.body;

          expect(body).toEqual({
            error: 'No such destination: store3'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/all/category/:category/stocklist', () => {
    it('should send request to multiple destination and be handled by route onResponse (multiple destination)', (done) => {
      request.
        get('/api/store/all/category/toys/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            results: {
              store1: {
                ip: '127.0.0.1:8082',
                category: 'toys',
                stock: 'stock list for toys here...'
              },
              store2: {
                ip: '127.0.0.1:8082',
                category: 'toys',
                stock: 'stock list for toys here...'
              }
            },
            text: 'The response was handled by onResponse handler.',
            token: jasmine.any(String)
          });
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('GET /api/store/:destination/category/:category/stocklist', () => {
    it('should send request and be intercepted by route onResponse (multiple destination)', (done) => {
      request.
        get('/api/store/store1/category/games/stocklist').
        set('authorization', `Bearer ${token}`).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            store: 'store1',
            ip: '127.0.0.1:8082',
            category: 'games',
            stock: 'stock list for games here...',
            text: 'The response was intercepted by onResponse handler.',
            token: jasmine.any(String)
          });
          expect(utils.isJWT(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
