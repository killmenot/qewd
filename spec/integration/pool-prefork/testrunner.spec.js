'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/pool-prefork:', () => {
  let cp;
  let data;

  const options = {
    cwd: __dirname
  };

  beforeAll((done) => {
    cp = utils.fork('./qewd', options, done);
  });

  beforeAll((done) => {
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

  afterAll((done) => {
    utils.exit(cp, done);
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