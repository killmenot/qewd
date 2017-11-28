'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/basic:', () => {
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

  it('should return correct html', (done) => {
    request
      .get('/test-app')
      .redirects(2)
      .expect(res => {
        expect(res.text).toBe('<h1>It Works</h1>');
      })
      .end(err => err ? done.fail(err) : done());
  });

  describe('ewd-register', () => {
    let data;

    beforeEach(() => {
      data = {
        type: 'ewd-register',
        application: 'test-app'
      };
    });

    it('should register app using websockets', (done) => {
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
        expect(utils.isUUID(responseObj.message.token)).toBeTruthy();

        done();
      });
    });

    it('should register app using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(utils.isUUID(res.body.token)).toBeTruthy();
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('ewd-reregister', () => {
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

    it('should reregister app using websockets', (done) => {
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

    it('should reregister app using ajax', (done) => {
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

    it('should send message using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'test',
          finished: true,
          message: {
            text: 'You sent: Hello world'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should send message using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'You sent: Hello world'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('no type handler', () => {
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

    it('should return error message using websockets', (done) => {
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

    it('should return error message using ajax', (done) => {
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
