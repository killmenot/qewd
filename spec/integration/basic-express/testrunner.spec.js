'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const isUUID = require('is-uuid');
const utils = require('../utils');

describe('integration/qewd/basic-express:', () => {
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

  it('should return correct html markup', (done) => {
    request
      .get('/test-app')
      .redirects(2)
      .expect(res => {
        expect(res.text).toBe('<h1>It Works</h1>');
      })
      .end(err => err ? done.fail(err) : done());
  });

  describe('register', () => {
    let data;

    beforeEach(() => {
      data = {
        type: 'ewd-register',
        application: 'test-app'
      };
    });

    it('should be able to register app using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'ewd-register',
          finished: true,
          message: {
            token: jasmine.any(String)
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });
        expect(isUUID.v4(responseObj.message.token)).toBeTruthy();

        done();
      });
    });

    it('should be able to register app using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(isUUID.v4(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('reregister', () => {
    let data;

    beforeEach((done) => {
      request.
        post('/ajax').
        send({
          type: 'ewd-register',
          application: 'test-app'
        }).
        end((err, res) => {
          if (err) return done.fail(err);

          data = {
            type: 'ewd-reregister',
            token: res.body.token
          };

          done();
        });
    });

    it('should be able to reregister app using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'ewd-reregister',
          finished: true,
          message: {
            ok: true
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should be able to reregister app using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            ok: true
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('custom message', () => {
    let data;

    beforeEach((done) => {
      request.
        post('/ajax').
        send({
          type: 'ewd-register',
          application: 'test-app'
        }).
        end((err, res) => {
          if (err) return done.fail(err);

          data = {
            type: 'test',
            token: res.body.token,
            params: {
              text: 'Hello world'
            }
          };

          done();
        });
    });

    it('should be able to send message using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'test',
          finished: true,
          message: {
            text: 'You sent: Hello world via express'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should be able to send message using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'You sent: Hello world via express'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('no type handler error', () => {
    let data;

    beforeEach((done) => {
      request.
        post('/ajax').
        send({
          type: 'ewd-register',
          application: 'test-app'
        }).
        end((err, res) => {
          if (err) return done.fail(err);

          data = {
            type: 'non-existent-type',
            token: res.body.token
          };

          done();
        });
    });

    it('should be able to return error message using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'non-existent-type',
          finished: true,
          message: {
            error: 'No handler defined for test-app messages of type non-existent-type'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should be able to return error message using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(400).
        expect(res => {
          expect(res.body).toEqual({
            error: 'No handler defined for test-app messages of type non-existent-type'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
