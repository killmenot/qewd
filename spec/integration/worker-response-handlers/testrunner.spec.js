'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/worker-response-handlers:', () => {
  let cp;
  let token;
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
        application: 'ewd-application-mock'
      }).
      end((err, res) => {
        if (err) return done.fail(err);

        token = res.body.token;

        done();
      });
  });

  afterAll((done) => {
    utils.exit(cp, done);
  });

  describe('replaced by worker response handler', () => {
    beforeEach(() => {
      data = {
        type: 'bar',
        token: token
      };
    });

    it('should return response replaced by worker response handler using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'bar',
          finished: true,
          message: {
            text: 'This is message is from bar worker response handler'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should return response replaced by worker response handler using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            text: 'This is message is from bar worker response handler'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('handled by worker response handler', () => {
    beforeEach(() => {
      data = {
        type: 'baz',
        token: token
      };
    });

    it('should return response handled by worker response handler using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'baz',
          finished: true,
          message: {
            text: 'This is message was handled by baz worker response handler'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    // TODO: need to be reviewed
    // https://github.com/robtweed/ewd-qoper8-express/issues/8
    it('should should return response handled by worker response handler using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual(true);
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
