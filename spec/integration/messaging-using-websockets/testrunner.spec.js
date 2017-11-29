'use strict';

const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/messaging-using-websockets:', () => {
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

  describe('sending message to all connected clients', () => {
    it('should send correct messages', (done) => {
      const state = [];
      const tokens = {};

      const collect = (id, response) => {
        if (response.type === 'ewd-register') {
          tokens[id] = response.message.token;
        }

        state.push({id, response});
      };

      const socket1 = io.connect('ws://localhost:8080', { forceNew: true });
      socket1.on('ewdjs', (responseObj) => collect('socket1', responseObj));

      const socket2 = io.connect('ws://localhost:8080', { forceNew: true });
      socket2.on('ewdjs', (responseObj) => collect('socket2', responseObj));

      socket1.on('connect', () =>
        socket1.emit('ewdjs', {
          type: 'ewd-register',
          application: 'ewd-application-mock',
          jwt: true
        })
      );

      socket2.on('connect', () =>
        socket2.emit('ewdjs', {
          type: 'ewd-register',
          application: 'baz',
          jwt: true
        })
      );

      setTimeout(() => {
        socket1.emit('ewdjs', {
          type: 'foo',
          token: tokens.socket1,
          jwt: true
        });
      }, process.env.SOCKET_MESSAGING_MESSAGE_TIMEOUT);

      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();

        expect(state.length).toBe(5);
        expect(state).toEqual(
          jasmine.arrayContaining([
            {
              id: 'socket1',
              response: {
                test: 'message1'
              }
            },
            {
              id: 'socket2',
              response: {
                test: 'message1'
              }
            }
          ])
        );

        done();
      }, process.env.SOCKET_MESSAGING_EXPECT_TIMEOUT);
    });
  });

  describe('sending message to application connected clients ', () => {
    it('should send correct messages', (done) => {
      const state = [];
      const tokens = {};

      const collect = (id, response) => {
        if (response.type === 'ewd-register') {
          tokens[id] = response.message.token;
        }

        state.push({id, response});
      };

      const socket1 = io.connect('ws://localhost:8080', { forceNew: true });
      socket1.on('ewdjs', (responseObj) => collect('socket1', responseObj));

      const socket2 = io.connect('ws://localhost:8080', { forceNew: true });
      socket2.on('ewdjs', (responseObj) => collect('socket2', responseObj));

      socket1.on('connect', () =>
        socket1.emit('ewdjs', {
          type: 'ewd-register',
          application: 'ewd-application-mock',
          jwt: true
        })
      );

      socket2.on('connect', () =>
        socket2.emit('ewdjs', {
          type: 'ewd-register',
          application: 'baz',
          jwt: true
        })
      );

      setTimeout(() => {
        socket1.emit('ewdjs', {
          type: 'quux',
          token: tokens.socket1,
          jwt: true
        });
      }, process.env.SOCKET_MESSAGING_MESSAGE_TIMEOUT);

      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();

        expect(state.length).toBe(4);
        expect(state).toEqual(
          jasmine.arrayContaining([
            {
              id: 'socket1',
              response: {
                test: 'message2'
              }
            }
          ])
        );

        done();
      }, process.env.SOCKET_MESSAGING_EXPECT_TIMEOUT);
    });
  });
});
