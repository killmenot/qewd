'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/ewd-fragment:', () => {
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
          type: 'ewd-fragment',
          service: 'ewd-mock',
          token: res.body.token,
          params: {
            file: 'template.html',
            targetId: 'targetId'
          }
        };

        done();
      });
  });

  describe('ewd-fragment', () => {
    it('should get fragment using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'ewd-fragment',
          finished: true,
          message: {
            fragmentName: 'template.html',
            content: '<h2>This is fragment</h2>'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should get fragment using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(200).
        expect(res => {
          expect(res.body).toEqual({
            fragmentName: 'template.html',
            content: '<h2>This is fragment</h2>'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('have no permissions', () => {
    beforeEach(() => {
      data.service = 'ewd-quux';
    });

    it('should not get fragment due to permissions using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'ewd-fragment',
          finished: true,
          message: {
            error: 'ewd-quux service is not permitted for the demo application'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should not get fragment due to permissions using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(400).
        expect(res => {
          expect(res.body).toEqual({
            error: 'ewd-quux service is not permitted for the demo application'
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });

  describe('file does not exist', () => {
    beforeEach(() => {
      data.params.file = 'quux.html';
    });

    it('should not get fragment due because template not found using websockets', (done) => {
      const socket = io.connect('ws://localhost:8080');

      socket.on('connect', () => socket.emit('ewdjs', data));
      socket.on('ewdjs', (responseObj) => {
        socket.disconnect();

        expect(responseObj).toEqual({
          type: 'ewd-fragment',
          finished: true,
          message: {
            error: 'Fragment file quux.html does not exist',
            file: 'quux.html',
            service: 'ewd-mock'
          },
          responseTime: jasmine.stringMatching(/^\d*ms$/)
        });

        done();
      });
    });

    it('should not get fragment due to permissions using ajax', (done) => {
      request.
        post('/ajax').
        send(data).
        expect(400).
        expect(res => {
          expect(res.body).toEqual({
            error: 'Fragment file quux.html does not exist',
          });
        }).
        end(err => err ? done.fail(err) : done());
    });
  });
});
