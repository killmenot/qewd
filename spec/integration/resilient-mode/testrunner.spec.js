'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const isUUID = require('is-uuid');
const utils = require('../utils');

describe('integration/qewd/resilient-mode:', () => {
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
  });
});
