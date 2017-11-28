'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

// resilient mode doesn't work with GT.M / Yotta
// https://github.com/robtweed/qewd/issues/32
(utils.db().type === 'gtm' ? xdescribe : describe)('integration/qewd/resilient-mode:', () => {
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

    it('should be able to send message using websockets', (done) => {
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
});
