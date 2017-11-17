'use strict';

const request = require('supertest')('http://localhost:8080');
const io = require('socket.io-client');
const utils = require('../utils');

describe('integration/qewd/basic:', () => {
  let cp;
  let token;

  const options = {
    cwd: __dirname
  };

  beforeAll((done) => {
    cp = utils.fork('./qewd', options, done);
  });

  afterAll((done) => {
    utils.exit(cp, done);
  });

  it('should return correct response', (done) => {
    request
      .get('/test-app')
      .redirects(2)
      .end((err) => {
        if (err) return done.fail(err);

        //console.log(res.text);
        done();
      });
  });

  it('should be able to register app', (done) => {
    //`ws://localhost:8080/so?token=${token}&meetingId=${meetingId}&transport=websocket&apiKey=${API_KEY}`
    const socket = io.connect('ws://localhost:8080');

    socket.on('connect', () => {
      socket.emit('ewdjs', {
        type: 'ewd-register',
        application: 'test-app',
        jwt: false
      });
    });

    socket.on('ewdjs', (responseObj) => {
      token = responseObj.message.token;
      socket.disconnect();
      done();
    });
  });

  it('should be able to reregister app', (done) => {
    //`ws://localhost:8080/so?token=${token}&meetingId=${meetingId}&transport=websocket&apiKey=${API_KEY}`
    const socket = io.connect('ws://localhost:8080');

    socket.on('connect', () => {
      socket.emit('ewdjs', {
        type: 'ewd-reregister',
        token: token
      });
    });

    socket.on('ewdjs', () => {
      socket.disconnect();
      //console.log(2, responseObj);
      done();
    });
  });
});
