'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/uws-engine:', () => {
  let cp;
  let data;

  const options = {
    cwd: __dirname
  };

  beforeAll((done) => {
    cp = utils.fork('./qewd', options, done);
  });

  afterAll((done) => {
    utils.exit(cp, done);
  });

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

  it('should send message using websockets and uWS engine', (done) => {
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
});
