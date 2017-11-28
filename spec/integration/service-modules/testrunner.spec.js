'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/service-modules:', () => {
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
        application: 'demo'
      }).
      end((err, res) => {
        if (err) return done.fail(err);

        data = {
          type: 'helloWorld',
          service: 'ewd-helloworld-service',
          token: res.body.token
        };

        done();
      });
  });

  describe('sending message to service', () => {
    it('should send message using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'helloWorld',
          finished: true,
          message: {
            type: 'helloWorld',
            text: 'Hello world!'
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
            type: 'helloWorld',
            text: 'Hello world!'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('service has no permissions', () => {
    beforeEach(() => {
      data.service = 'ewd-mock';
      data.type = 'mock';
    });

    it('should return permissions error using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'mock',
          finished: true,
          message: {
            service: 'ewd-mock',
            error: 'ewd-mock service is not permitted for the demo application'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should return permissions error using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(400).
        expect(res => {
          expect(res.body).toEqual({
            error: 'ewd-mock service is not permitted for the demo application'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('no handler type', () => {
    beforeEach(() => {
      data.type = 'quux';
    });

    it('should return no handler found error using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'quux',
          finished: true,
          message: {
            service: 'ewd-helloworld-service',
            error: 'No handler defined for ewd-helloworld-service service messages of type quux'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should return no handler found using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(400).
        expect(res => {
          expect(res.body).toEqual({
            error: 'No handler defined for ewd-helloworld-service service messages of type quux',
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
