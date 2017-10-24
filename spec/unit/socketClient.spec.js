'use strict';

const events = require('events');
const rewire = require('rewire');
const SocketClient = rewire('../../lib/socketClient');

describe('unit/socketClient:', () => {
  let Socket;
  let socketClient;
  let jwtHandler;
  let socket;
  let io;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };
  const initialize = () => {
    const params = {
      url: 'http://192.168.1.121:8080',
      application: 'login-micro-service',
      log: true,
      jwt: {
        secret: 'keep it private'
      }
    };

    socketClient.start(params);
  };

  beforeAll(() => {
    Socket = function () {
      events.EventEmitter.call(this);

      this.disconnect = jasmine.createSpy();
    };

    Socket.prototype = Object.create(events.EventEmitter.prototype);
    Socket.prototype.constructor = Socket;
  });

  beforeEach(() => {
    socketClient = new SocketClient();

    jwtHandler = jasmine.createSpyObj(['updateJWTExpiry']);
    jwtHandler.__revert__ = SocketClient.__set__('jwtHandler', jwtHandler);

    socket = new Socket();
    io = jasmine.createSpy().and.returnValue(socket);
    io.__revert__ = SocketClient.__set__('io', io);
  });

  afterEach(() => {
    revert(jwtHandler);
    revert(io);
  });

  it('should be instance of EventEmitter', () => {
    expect(socketClient instanceof events.EventEmitter).toBeTruthy();
  });

  it('should have default props', () => {
    expect(socketClient.application).toBe('undefined');
    expect(socketClient.log).toBeFalsy();
    expect(socketClient.token).toBeFalsy();
  });

  describe('start', () => {
    it('should not initialize socket', () => {
      const params = {};

      socketClient.start(params);

      expect(socketClient.application).toBe('undefined');
      expect(socketClient.url).toBeFalsy();
      expect(socketClient.log).toBeFalsy();
      expect(socketClient.jwt).toBeFalsy();
      expect(socketClient.connected).toBeFalsy();
      expect(socketClient.hasEventHandler).toBeUndefined();

      expect(io).not.toHaveBeenCalled();
    });

    it('should initialize socket', () => {
      const params = {
        url: 'http://192.168.1.121:8080',
        application: 'login-micro-service',
        log: true,
        jwt: {
          secret: 'keep it private'
        }
      };

      socketClient.start(params);

      expect(socketClient.application).toBe('login-micro-service');
      expect(socketClient.url).toBe('http://192.168.1.121:8080');
      expect(socketClient.log).toBeTruthy();
      expect(socketClient.jwt).toEqual({
        secret: 'keep it private'
      });
      expect(socketClient.hasEventHandler).toEqual({});

      expect(io).toHaveBeenCalledWith('http://192.168.1.121:8080', {
        transports: ['websocket']
      });
    });

    describe('`error`', () => {
      it('should be able to add event handler', () => {
        spyOn(socketClient, 'on');
        initialize();

        expect(socketClient.on).toHaveBeenCalledWith('error', jasmine.any(Function));
      });
    });

    describe('handle websockets connect', () => {
      let connectHandler;

      beforeEach(() => {
        initialize();
        connectHandler = socket.listeners('connect')[0];
        spyOn(socket, 'emit');
      });

      describe('#disconnectSocket', () => {
        it('should be defined', () => {
          connectHandler();

          expect(socketClient.disconnectSocket).toEqual(jasmine.any(Function));
        });

        it('should be able to disconnect from websockets', () => {
          connectHandler();
          socketClient.disconnectSocket();

          expect(socket.disconnect).toHaveBeenCalled();
        });
      });

      it('should set connected', () => {
        expect(socketClient.connected).toBeFalsy();

        connectHandler();

        expect(socketClient.connected).toBeTruthy();
      });

      it('should emit ewdjs event with ewd-reregister message type via websockets', () => {
        socketClient.token = 'quux';
        jwtHandler.updateJWTExpiry.and.returnValue('baz');

        connectHandler();

        expect(jwtHandler.updateJWTExpiry).toHaveBeenCalledWithContext(socketClient, 'quux');
        expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
          type: 'ewd-reregister',
          token: 'baz',
          jwt: true
        });
      });

      it('should emit ewdjs event with ewd-reregister message type without jwt via websockets', () => {
        socketClient.jwt = false;
        socketClient.token = 'quux';
        jwtHandler.updateJWTExpiry.and.returnValue('baz');

        connectHandler();

        expect(jwtHandler.updateJWTExpiry).toHaveBeenCalledWithContext(socketClient, 'quux');
        expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
          type: 'ewd-reregister',
          token: 'baz'
        });
      });

      it('should emit ewdjs event with ewd-register message type via websockets', () => {
        connectHandler();

        expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
          type: 'ewd-register',
          application: 'login-micro-service',
          jwt: true
        });
      });

      it('should emit ewdjs event with ewd-register message type without jwt via websockets', () => {
        socketClient.jwt = false;

        connectHandler();

        expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
          type: 'ewd-register',
          application: 'login-micro-service'
        });
      });
    });

    describe('handle websockets ewdjs', () => {
      let ewdjsHandler;

      beforeEach(() => {
        initialize();
        ewdjsHandler = socket.listeners('ewdjs')[0];
        spyOn(socketClient, 'emit');
      });

      it('handle messages with ewd-register type', () => {
        const messageObj = {
          type: 'ewd-register',
          message: {
            token: 'quux'
          }
        };

        ewdjsHandler(messageObj);

        expect(socketClient.emit).toHaveBeenCalledWith('ewd-registered');
        expect(socketClient.token).toBe('quux');
      });

      it('handle messages with ewd-reregister type', () => {
        const messageObj = {
          type: 'ewd-reregister'
        };

        ewdjsHandler(messageObj);

        expect(socketClient.emit).toHaveBeenCalledWith('ewd-reregistered');
      });

      it('handle messages with error', () => {
        const messageObj = {
          message: {
            error: {
              text: 'some error'
            }
          }
        };

        ewdjsHandler(messageObj);

        expect(socketClient.emit).toHaveBeenCalledWith('restRequest', messageObj);
      });

      it('handle other messages', () => {
        const messageObj = {
          type: 'baz',
          message: {
            foo: 'bar'
          }
        };

        ewdjsHandler(messageObj);

        expect(socketClient.emit).toHaveBeenCalledWith('baz', messageObj);
      });
    });

    describe('handle websockets disconnect', () => {
      let disconnectHandler;

      beforeEach(() => {
        initialize();
        disconnectHandler = socket.listeners('disconnect')[0];
        spyOn(socketClient, 'emit');
      });

      it('should set connected to false', () => {
        socketClient.connected = true;

        disconnectHandler();

        expect(socketClient.connected).toBeFalsy();
      });

      it('should emit socketDisconnected', () => {
        disconnectHandler();

        expect(socketClient.emit).toHaveBeenCalledWith('socketDisconnected');
      });
    });

    describe('#addHandler', () => {
      beforeEach(() => {
        initialize();
        spyOn(socketClient, 'on');
      });

      it('should be able to add handler for type', () => {
        const callback = jasmine.createSpy();

        socketClient.addHandler('foo', callback);

        expect(socketClient.on).toHaveBeenCalledWith('foo', callback);
        expect(socketClient.hasEventHandler).toEqual({
          foo: callback
        });
      });
    });

    describe('#sub', () => {
      beforeEach(() => {
        initialize();
      });

      it('should be a reference to addHandler', () => {
        expect(socketClient.sub).toBe(socketClient.addHandler);
      });
    });

    describe('#removeHandler', () => {
      beforeEach(() => {
        initialize();
        spyOn(socketClient, 'removeListener');
      });

      it('should be able to remove handler for type', () => {
        const callback = jasmine.createSpy();

        socketClient.hasEventHandler = {
          baz: callback
        };

        socketClient.removeHandler('baz');

        expect(socketClient.removeListener).toHaveBeenCalledWith('baz', callback);
        expect(socketClient.hasEventHandler).toEqual({
          baz: false
        });
      });
    });

    describe('#send', () => {
      beforeEach(() => {
        initialize();
        spyOn(socket, 'emit');

        const connectHandler = socket.listeners('connect')[0];
        connectHandler();
      });

      it('should return microService connection is down error', () => {
        const messageObj = {};
        const callback = jasmine.createSpy();

        socketClient.connected = false;

        socketClient.send(messageObj, callback);

        expect(callback).toHaveBeenCalledWith({
          error: 'MicroService connection is down',
          status: {
            code: 503
          }
        });
      });

      it('should emit ewdjs event message object via websockets', () => {
        const messageObj = {
          type: 'foo'
        };

        socketClient.log = false;
        socketClient.send(messageObj);

        expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
          type: 'foo'
        });
      });

      it('should be able to set callback for type', () => {
        const messageObj = {
          type: 'foo'
        };
        const callback = jasmine.createSpy();

        spyOn(socketClient, 'addHandler');

        socketClient.send(messageObj, callback);

        expect(socketClient.addHandler).toHaveBeenCalledWith('foo', callback);
      });

      it('should be able to changed callback for type', () => {
        const messageObj = {
          type: 'foo'
        };
        const callback1 = jasmine.createSpy();
        const callback2 = jasmine.createSpy();

        socketClient.hasEventHandler[messageObj.type] = callback1;

        spyOn(socketClient, 'removeHandler').and.callFake((type) => delete socketClient.hasEventHandler[type]);
        spyOn(socketClient, 'addHandler');

        socketClient.send(messageObj, callback2);

        expect(socketClient.removeHandler).toHaveBeenCalledWith('foo');
        expect(socketClient.addHandler).toHaveBeenCalledWith('foo', callback2);
      });

      it('should not be able to changed callback for type', () => {
        const messageObj = {
          type: 'foo'
        };
        const callback = jasmine.createSpy();

        socketClient.hasEventHandler[messageObj.type] = callback;

        spyOn(socketClient, 'removeHandler');
        spyOn(socketClient, 'addHandler');

        socketClient.send(messageObj, callback);

        expect(socketClient.removeHandler).not.toHaveBeenCalled();
        expect(socketClient.addHandler).not.toHaveBeenCalled();
      });
    });
  });
});
