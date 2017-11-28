'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/intermediate-messages:', () => {
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

  it('should not be able to recieve intermediate message using ajax', (done) => {
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

  it('should be able to recieve intermediate message using websockets', (done) => {
    const socket = io.connect('ws://localhost:8080');
    const state = [];

    socket.on('connect', () => socket.emit('ewdjs', data));
    socket.on('ewdjs', (responseObj) => {
      state.push(responseObj);

      if (responseObj.finished) {
        socket.disconnect();

        const responseObj1 = state[0];
        expect(responseObj1).toEqual({
          type: 'test',
          finished: false,
          message: {
            text: 'You sent intermediate message'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        const responseObj2 = state[1];
        expect(responseObj2).toEqual({
          type: 'test',
          finished: true,
          message: {
            text: 'You sent: Hello world'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      }
    });
  });
});
