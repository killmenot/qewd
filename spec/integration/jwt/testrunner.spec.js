'use strict';

const io = require('socket.io-client');
const isJWT = require('is-jwt');
const utils = require('../utils');

describe('integration/qewd/jwt:', () => {
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
    it('should be able to register app using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');
      const data = {
        type: 'ewd-register',
        application: 'test-jwt-app',
        jwt: true
      };

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
        expect(isJWT(responseObj.message.token)).toBeTruthy();

        done();
      });
    });
  });

  describe('reregister', () => {
    let data;

    beforeEach((done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => {
        socket.emit('ewdjs', {
          type: 'ewd-register',
          application: 'test-jwt-app',
          jwt: true
        });
      });

      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        data = {
          type: 'ewd-reregister',
          token: responseObj.message.token,
          jwt: true
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
            ok: true,
            token: jasmine.any(String)
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });
        expect(isJWT(responseObj.message.token)).toBeTruthy();

        done();
      });
    });
  });

  describe('custom message', () => {
    let data;

    beforeEach((done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => {
        socket.emit('ewdjs', {
          type: 'ewd-register',
          application: 'test-jwt-app',
          jwt: true
        });
      });

      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        data = {
          type: 'test',
          jwt: true,
          token: responseObj.message.token,
          params: {
            text: 'Hello world!'
          }
        };

        done();
      });
    });

    it('should be able to send message using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => {
        socket.emit('ewdjs', data);
      });

      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'test',
          finished: true,
          message: {
            text: 'You sent: Hello world!',
            token: jasmine.any(String)
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });
        expect(isJWT(responseObj.message.token)).toBeTruthy();

        done();
      });
    });
  });
});
