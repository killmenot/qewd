'use strict';

var events = require('events');
var mockery = require('mockery');
var rewire = require('rewire');
var dbMock = require('./mocks/db');
var documentStoreMock = require('./mocks/documentStore');
var sessionsMock = require('./mocks/sessions');
var appHandler = rewire('../../lib/appHandler');
var loadModuleSpec = require('./shared/appHandler/loadModuleSpec');

describe('unit/appHandler:', function () {
  var Worker;
  var worker;
  var db;
  var documentStore;
  var sessions;
  var send;
  var finished;
  var handleJWT;
  var getFragment;
  var resilientMode;
  var session;

  var revert = function (obj) {
    obj.__revert__();
    delete obj.__revert__;
  };

  var boot = function (cb) {
    cb(appHandler, worker, send, finished, handleJWT, session);
  };

  beforeAll(function () {
    Worker = function () {
      this.userDefined = {};
      this.errorMessages = {};
      this.servicesAllowed = {};
      this.restModule = {};
      this.handlers = {};
      this.beforeHandlers = {};
      this.afterHandlers = {};

      events.EventEmitter.call(this);
    };

    Worker.prototype = Object.create(events.EventEmitter.prototype);
    Worker.prototype.constructor = Worker;

    mockery.enable();
  });

  afterAll(function () {
    mockery.disable();
  });

  beforeEach(function () {
    db = dbMock.mock();

    documentStore = documentStoreMock.mock();
    sessions = sessionsMock.mock();

    handleJWT = jasmine.createSpyObj([
      'decodeJWT',
      'encodeJWT',
      'updateJWT',
      'updateJWTExpiry',
      'isJWTValid',
      'register',
      'validate',
      'reregister'
    ]);
    handleJWT.__revert__ = appHandler.__set__('handleJWT', handleJWT);

    getFragment = jasmine.createSpy();
    getFragment.__revert__ = appHandler.__set__('getFragment', getFragment);

    resilientMode = jasmine.createSpyObj(['storeWorkerStatusUpdate']);
    resilientMode.__revert__ = appHandler.__set__('resilientMode', resilientMode);

    send = jasmine.createSpy();
    finished = jasmine.createSpy();

    worker = new Worker();
    worker.db = db;
    worker.documentStore = documentStore;
    worker.sessions = sessions;
    worker.userDefined.config = {};
  });

  afterEach(function () {
    revert(handleJWT);
    revert(resilientMode);

    mockery.deregisterAll();
  });

  it('should add message event handler', function () {
    spyOn(worker, 'on');

    appHandler.call(worker);

    expect(worker.on).toHaveBeenCalledWith('message', jasmine.any(Function));
  });

  describe('resilientMode', function () {
    beforeEach(function () {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should update worker status to started/error', function () {
      var messageObj = {
        type: 'ewd-jwt-decode',
        params: {},
        dbIndex: '4'
      };

      handleJWT.decodeJWT.and.returnValue({
        error: 'decodeJWT internal error'
      });

      worker.userDefined.config.resilientMode = true;

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledTimes(2);
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(0)).toEqual([messageObj, 'started']);
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(1)).toEqual([messageObj, 'error']);
      expect(finished).toHaveBeenCalledWith({
        error: 'decodeJWT internal error'
      });
    });

    it('should update worker status to started/finished', function () {
      var messageObj = {
        type: 'ewd-jwt-decode',
        params: {},
        dbIndex: '4'
      };

      handleJWT.decodeJWT.and.returnValue({
        foo: 'bar'
      });

      worker.userDefined.config.resilientMode = true;

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledTimes(2);
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(0)).toEqual([messageObj, 'started']);
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(1)).toEqual([messageObj, 'finished']);
      expect(finished).toHaveBeenCalledWith({
        foo: 'bar'
      });
    });
  });

  describe('no documentStore defined', function () {
    beforeEach(function () {
      delete worker.documentStore;
    });

    it('should finished with standard error', function () {
      var messageObj = {};

      appHandler.call(worker);

      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No Document Store has been created - you must use ewd-document-store!'
      });
    });

    it('should finished with custom error (string)', function () {
      var messageObj = {
        application: 'foo'
      };

      worker.errorMessages[messageObj.application] = {
        'noDocumentStore': 'No Document Store - custom error'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No Document Store - custom error'
      });
    });

    it('should finished with custom error (object)', function () {
      var messageObj = {
        application: 'foo'
      };

      worker.errorMessages[messageObj.application] = {
        'noDocumentStore': {
          statusCode: 500,
          text: 'No Document Store - custom error'
        }
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No Document Store - custom error',
        status: {
          code: 500
        }
      });
    });
  });

  describe('ewd-jwt-decode', function () {
    it('should handle message', function () {
      var messageObj = {
        type: 'ewd-jwt-decode',
        params: {
          jwt: 'jwtToken'
        }
      };

      handleJWT.decodeJWT.and.returnValue({
        foo: 'bar'
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.decodeJWT).toHaveBeenCalledWith('jwtToken');
      expect(finished).toHaveBeenCalledWith({
        foo: 'bar'
      });
    });
  });

  describe('ewd-jwt-encode', function () {
    it('should handle message', function () {
      var messageObj = {
        type: 'ewd-jwt-encode',
        params: {
          payload: {
            bar: 'baz'
          }
        }
      };

      handleJWT.encodeJWT.and.returnValue('jwtToken');

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.encodeJWT).toHaveBeenCalledWith({
        bar: 'baz'
      });
      expect(finished).toHaveBeenCalledWith({
        jwt: 'jwtToken'
      });
    });
  });

  describe('ewd-jwt-updateExpiry', function () {
    it('should handle message', function () {
      var messageObj = {
        type: 'ewd-jwt-updateExpiry',
        params: {
          jwt: 'jwtToken',
          application: 'foo'
        }
      };

      handleJWT.updateJWTExpiry.and.returnValue('jwtTokenUpdated');

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.updateJWTExpiry).toHaveBeenCalledWith('jwtToken', 'foo');
      expect(finished).toHaveBeenCalledWith({
        jwt: 'jwtTokenUpdated'
      });
    });
  });

  describe('ewd-jwt-isValid', function () {
    it('should handle message', function () {
      var messageObj = {
        type: 'ewd-jwt-isValid',
        params: {
          jwt: 'jwtToken'
        }
      };

      handleJWT.isJWTValid.and.returnValue({
        ok: true
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.isJWTValid).toHaveBeenCalledWith('jwtToken');
      expect(finished).toHaveBeenCalledWith({
        ok: true
      });
    });
  });

  describe('ewd-qoper8-express', function () {
    var application = 'baz';
    var messageObj;

    beforeEach(function () {
      worker.restModule[application] = true;

      messageObj = {
        type: 'ewd-qoper8-express',
        application: application
      };
    });

    loadModuleSpec(mockery, boot, {
      moduleName: application,
      onMessage: function () {
        return messageObj;
      },
      onSuccess: function () {
        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for baz messages of type ewd-qoper8-express'
        });
      }
    });

    describe('rest module', function () {
      describe('no handler type', function () {
        it('should finished with standard error', function () {
          worker.handlers[messageObj.application] = {};

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(finished).toHaveBeenCalledWith({
            error: 'No handler defined for baz messages of type ewd-qoper8-express'
          });
        });

        it('should finished with custom error (string)', function () {
          worker.handlers[messageObj.application] = {};

          worker.errorMessages[messageObj.application] = {
            'noTypeHandler': 'No handler type - custom error'
          };

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(finished).toHaveBeenCalledWith({
            error: 'No handler type - custom error'
          });
        });

        it('should finished with custom error (object)', function () {
          worker.handlers[messageObj.application] = {};

          worker.errorMessages[messageObj.application] = {
            'noTypeHandler': {
              statusCode: 500,
              text: 'No handler type - custom error'
            }
          };

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(finished).toHaveBeenCalledWith({
            error: 'No handler type - custom error',
            status: {
              code: 500
            }
          });
        });
      });

      it('should call application handler', function () {
        var appModule = {
          handlers: {
            'ewd-qoper8-express': jasmine.createSpy().and.callFake(function (messageObj, finalise) {
              finalise();
            })
          }
        };
        mockery.registerMock(application, appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers[messageObj.type]).toHaveBeenCalledWith(messageObj, jasmine.any(Function));
        expect(finished).toHaveBeenCalledWith({
          ewd_application: 'baz',
          restMessage: true
        });
      });

      describe('before handler', function () {
        it('should run beforeHandler before handler', function () {
          var appModule = {
            beforeHandler: jasmine.createSpy().and.returnValue(true),
            handlers: {
              'ewd-qoper8-express': jasmine.createSpy().and.callFake(function (messageObj, finalise) {
                finalise();
              })
            }
          };
          mockery.registerMock(application, appModule);

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(appModule.beforeHandler).toHaveBeenCalledBefore(appModule.handlers[messageObj.type]);
          expect(appModule.beforeHandler).toHaveBeenCalledWith(messageObj, jasmine.any(Function));
        });

        it('should do not run handler', function () {
          var appModule = {
            beforeHandler: jasmine.createSpy().and.returnValue(false),
            handlers: {
              'ewd-qoper8-express': jasmine.createSpy()
            }
          };
          mockery.registerMock(application, appModule);

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(appModule.handlers[messageObj.type]).not.toHaveBeenCalled();
          expect(finished).not.toHaveBeenCalled();
        });
      });

      describe('after handler', function () {
        it('should run afterHandler after handler', function () {
          var appModule = {
            afterHandler: jasmine.createSpy(),
            handlers: {
              'ewd-qoper8-express': jasmine.createSpy().and.callFake(function (messageObj, finalise) {
                finalise();
              })
            }
          };
          mockery.registerMock(application, appModule);

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(appModule.handlers[messageObj.type]).toHaveBeenCalledBefore(appModule.afterHandler);
          expect(appModule.afterHandler).toHaveBeenCalledWith(messageObj, jasmine.any(Function));
        });
      });

      it('should set jwt handlers', function () {
        var appModule = {
          handlers: {
            'ewd-qoper8-express': jasmine.createSpy().and.callFake(function (messageObj, finalise) {
              finalise();
            })
          }
        };
        mockery.registerMock(application, appModule);

        worker.jwt = {};

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(worker.jwt.handlers).toBe(handleJWT);
      });
    });

    describe('ajax', function () {
      it('should handle ajax message', function () {
        messageObj = {
          type: 'ewd-qoper8-express',
          ip: '127.0.0.1',
          ips: ['client'],
          headers: {
            qewd: 'ajax'
          },
          body: {
            application: 'foo',
            type: 'baz'
          }
        };

        var appModule = {
          restModule: true,
          handlers: {
            baz: jasmine.createSpy()
          }
        };
        mockery.registerMock(messageObj.body.application, appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers.baz).toHaveBeenCalledWith({
          application: 'foo',
          type: 'baz',
          ip: '127.0.0.1',
          ips: ['client']
        }, jasmine.any(Function));
      });

      it('should handle message with ewd-register type in body', function () {
        messageObj = {
          type: 'ewd-qoper8-express',
          ip: '192.168.1.13',
          ips: ['client'],
          headers: {
            qewd: 'ajax'
          },
          body: {
            application: 'foo',
            type: 'ewd-register',
            jwt: 'jwtValue'
          }
        };

        worker.handlers[messageObj.body.application] = {};

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(handleJWT.register).toHaveBeenCalledWith({
          application: 'foo',
          type: 'ewd-register',
          jwt: 'jwtValue',
          ipAddress: '192.168.1.13',
          ip: '192.168.1.13',
          ips: ['client']
        });
        expect(finished).toHaveBeenCalled();
      });
    });

    describe('express type', function () {
      it('should replace type to expressType', function () {
        messageObj = {
          type: 'ewd-qoper8-express',
          expressType: 'ewd-bar',
          jwt: 'jwtValue'
        };

        session = {
          application: 'foo'
        };

        handleJWT.validate.and.returnValue({
          session: session
        });

        worker.handlers[session.application] = {};

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for foo messages of type ewd-bar'
        });
      });
    });
  });

  describe('ewd-register', function () {
    it('should handle message with jwt token', function () {
      var messageObj = {
        type: 'ewd-register',
        jwt: 'jwtToken'
      };

      handleJWT.register.and.returnValue('foobar');

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.register).toHaveBeenCalledWith(messageObj);
      expect(finished).toHaveBeenCalledWith('foobar');
    });

    it('should handle message without jwt token', function () {
      var messageObj = {
        type: 'ewd-register',
        application: 'foo'
      };
      var session = {
        token: 'baz'
      };

      worker.userDefined.config.initialSessionTimeout = 500;

      sessions.create.and.returnValue(session);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(sessions.create).toHaveBeenCalledWith({
        application: 'foo',
        timeout: 500
      });
      expect(finished).toHaveBeenCalledWith({
        token: 'baz'
      });
    });

    it('should handle message without jwt token but with additional props', function () {
      var messageObj = {
        type: 'ewd-register',
        application: 'foo',
        socketId: '/#yf_vd-S9Q7e-LX28AAAS',
        ipAddress: '127.0.0.1'
      };
      var session = {
        token: 'baz'
      };

      worker.userDefined.config.initialSessionTimeout = 500;

      sessions.create.and.returnValue(session);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(session.socketId).toBe('/#yf_vd-S9Q7e-LX28AAAS');
      expect(session.ipAddress).toBe('127.0.0.1');
    });
  });

  describe('auth', function () {
    it('should return error when jwt is invalid', function () {
      var messageObj = {
        type: '*',
        jwt: 'invalid-jwt'
      };

      handleJWT.validate.and.returnValue({
        error: 'jwt is invalid'
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWith(messageObj);
      expect(finished).toHaveBeenCalledWith({
        error: 'jwt is invalid',
        disconnect: true
      });
    });

    it('should authenticate with jwt', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      var result = {
        session: {
          application: 'foo'
        }
      };
      handleJWT.validate.and.returnValue(result);

      worker.handlers[result.session.application] = {};

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWith(messageObj);
      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });

    it('should return error when session token is invalid', function () {
      var messageObj = {
        type: '*',
        token: 'invalid-token'
      };

      sessions.authenticate.and.returnValue({
        error: 'token is invalid'
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(sessions.authenticate).toHaveBeenCalledWith('invalid-token', 'noCheck');
      expect(finished).toHaveBeenCalledWith({
        error: 'token is invalid',
        disconnect: true
      });
    });

    it('should authenticate with session token', function () {
      var messageObj = {
        type: '*',
        token: 'tokenValue'
      };

      var result = {
        session: {
          application: 'foo',
          updateExpiry: jasmine.createSpy()
        }
      };
      sessions.authenticate.and.returnValue(result);

      worker.handlers[result.session.application] = {};

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(sessions.authenticate).toHaveBeenCalledWith('tokenValue', 'noCheck');
      expect(result.session.updateExpiry).toHaveBeenCalled();
      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });

    it('should return custom error (string)', function () {
      var messageObj = {
        type: '*',
        token: 'invalid-token',
        application: 'foo'
      };

      var result = {
        error: 'token is invalid'
      };
      sessions.authenticate.and.returnValue(result);

      worker.errorMessages[messageObj.application] = {
        'sessionNotAuthenticated': 'Session not authenticated - custom error'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Session not authenticated - custom error',
        disconnect: true
      });
    });
  });

  describe('ewd-reregister', function () {
    beforeEach(function () {
      session = {
        socketId: 'socket-id'
      };
    });

    it('should handle message with jwt', function () {
      var messageObj = {
        type: 'ewd-reregister',
        jwt: 'jwtToken'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });

      var result = {
        ok: true,
        token: 'tokenValue'
      };
      handleJWT.reregister.and.returnValue(result);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWith(messageObj);
      expect(handleJWT.reregister).toHaveBeenCalledWith(session, messageObj);
      expect(finished).toHaveBeenCalledWith({
        ok: true,
        token: 'tokenValue'
      });
    });

    it('should handle message with session token', function () {
      var messageObj = {
        type: 'ewd-reregister',
        token: 'tokenValue',
        socketId: 'updated-socket-id'
      };

      sessions.authenticate.and.returnValue({
        session: session
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(sessions.authenticate).toHaveBeenCalledWith('tokenValue', 'noCheck');
      expect(session.socketId).toBe('updated-socket-id');
      expect(finished).toHaveBeenCalledWith({
        ok: true
      });
    });
  });

  describe('ewd-fragment', function () {
    beforeEach(function () {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should handle message with jwt', function () {
      var messageObj = {
        type: 'ewd-fragment',
        jwt: 'jwtToken'
      };

      var result = {
        session: {
          application: 'foo'
        }
      };
      handleJWT.validate.and.returnValue(result);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWith(messageObj);
      expect(getFragment).toHaveBeenCalledWith(messageObj, 'foo', finished);
    });

    it('should handle message with session token', function () {
      var messageObj = {
        type: 'ewd-fragment',
        token: 'tokenValue'
      };

      var result = {
        session: {
          application: 'foo',
          updateExpiry: jasmine.createSpy()
        }
      };
      sessions.authenticate.and.returnValue(result);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(sessions.authenticate).toHaveBeenCalledWith('tokenValue', 'noCheck');
      expect(result.session.updateExpiry).toHaveBeenCalled();
      expect(getFragment).toHaveBeenCalledWith(messageObj, 'foo', finished);
    });

    describe('should handle message with service prop', function () {
      var messageObj;

      beforeEach(function () {
        messageObj = {
          type: 'ewd-fragment',
          jwt: 'jwtToken',
          service: 'baz'
        };
      });

      loadModuleSpec(mockery, boot, {
        moduleName: 'foo',
        onMessage: function () {
          return messageObj;
        },
        onSuccess: function () {
          expect(getFragment).toHaveBeenCalledWith(messageObj, session.application, finished);
        },
        onError: function () {
          expect(getFragment).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('application handler', function () {
    var messageObj;

    beforeEach(function () {
      messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    loadModuleSpec(mockery, boot, {
      moduleName: 'foo',
      onMessage: function () {
        return messageObj;
      },
      onSuccess: function () {
        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for foo messages of type *'
        });
      }
    });
  });

  describe('session locking', function () {
    beforeEach(function () {
      session = {
        id: 'baz',
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should return error when session timed out', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '0'
      });

      var appModule = {};
      mockery.registerMock('foo', appModule);

      worker.userDefined.config = {
        sessionDocumentName: 'CacheTempEWDSession',
        lockSession: true
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(db.lock).toHaveBeenCalledWith({
        global: 'CacheTempEWDSession',
        subscripts: ['session', 'baz']
      }, 30);
      expect(finished).toHaveBeenCalledWith({
        error: 'Timed out waiting for EWD session to be released'
      });
    });

    it('should use custom session timeout value', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '0'
      });

      var appModule = {};
      mockery.registerMock('foo', appModule);

      worker.userDefined.config = {
        sessionDocumentName: 'CacheTempEWDSession',
        lockSession: {
          timeout: 50
        }
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(db.lock).toHaveBeenCalledWith({
        global: 'CacheTempEWDSession',
        subscripts: ['session', 'baz']
      }, 50);
    });

    it('should pass session locking', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '1'
      });

      var appModule = {};
      mockery.registerMock('foo', appModule);

      worker.userDefined.config = {
        sessionDocumentName: 'CacheTempEWDSession',
        lockSession: {
          timeout: 50
        }
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });
  });

  describe('service request', function () {
    var session;
    var application = 'foo';
    var service = 'baz';

    beforeEach(function () {
      session = {
        application: application,
        allowedServices: {}
      };

      handleJWT.validate.and.returnValue({
        session: session
      });

      worker.handlers[application] = {};
      worker.handlers[service] = {};
      session.allowedServices[service] = true;
    });

    describe('service not allowed error', function () {
      beforeEach(function () {
        delete session.allowedServices[service];
      });

      it('should finished with standard error', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'baz service is not permitted for the foo application',
          service: 'baz'
        });
      });

      it('should finished with custom error (string)', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        worker.errorMessages[application] = {
          'serviceNotAllowed': 'Service not allowed - custom error'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'Service not allowed - custom error',
          service: 'baz'
        });
      });
    });

    describe('service not allowed error for user', function () {
      beforeEach(function () {
        session.allowedServices[service] = false;
      });

      it('should finished with standard error', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'You are not allowed access to the baz service',
          service: 'baz'
        });
      });

      it('should finished with custom error (string)', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        worker.errorMessages[application] = {
          'serviceNotAllowedForUser': 'Service not allowed for user - custom error'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'Service not allowed for user - custom error',
          service: 'baz'
        });
      });
    });

    describe('service handler', function () {
      var messageObj;

      beforeEach(function () {
        messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        delete worker.handlers[service];
      });

      loadModuleSpec(mockery, boot, {
        moduleName: service,
        onMessage: function () {
          return messageObj;
        }
      });
    });

    describe('no service module type', function () {
      it('should finished with standard error', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for baz service messages of type bar',
          service: 'baz'
        });
      });

      it('should finished with custom error (string)', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        worker.errorMessages[application] = {
          'noServiceModuleType': 'No service module type - custom error'
        };

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(finished).toHaveBeenCalledWith({
          error: 'No service module type - custom error',
          service: 'baz'
        });
      });
    });

    it('should call service handler', function () {
      var messageObj = {
        type: 'bar',
        service: service,
        jwt: 'jwtToken'
      };

      var handler = jasmine.createSpy();
      worker.handlers[service][messageObj.type] = handler;

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handler).toHaveBeenCalledWith(messageObj, session, send, finished);
    });

    describe('before handler', function () {
      it('should run beforeHandler before handler', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        var handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        var beforeHandler = jasmine.createSpy();
        worker.beforeHandlers[service] = beforeHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(beforeHandler).toHaveBeenCalledBefore(handler);
        expect(beforeHandler).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      });

      it('should do not run handler', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        var handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        var beforeHandler = jasmine.createSpy().and.returnValue(false);
        worker.beforeHandlers[service] = beforeHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('after handler', function () {
      it('should run afterHandler after handler', function () {
        var messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        var handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        var afterHandler = jasmine.createSpy();
        worker.afterHandlers[service] = afterHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(handler).toHaveBeenCalledBefore(afterHandler);
        expect(afterHandler).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      });
    });
  });

  describe('application request', function () {
    var session;

    beforeEach(function () {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should call application handler', function () {
      var messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      handleJWT.updateJWT.and.returnValue('newJwtToken');

      var appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake(function (messageObj, session, send, finalise) {
            finalise();
          })
        }
      };
      mockery.registerMock('foo', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.handlers.baz).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      expect(handleJWT.updateJWT).toHaveBeenCalledWith(session);
      expect(finished).toHaveBeenCalledWith({
        ewd_application: 'foo',
        token: 'newJwtToken'
      });
    });

    it('should call application handler and handle error', function () {
      var messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      var appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake(function (messageObj, session, send, finalise) {
            finalise({
              error: 'update jwt error'
            });
          })
        }
      };
      mockery.registerMock('foo', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.handlers.baz).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      expect(handleJWT.updateJWT).not.toHaveBeenCalled();
      expect(finished).toHaveBeenCalledWith({
        ewd_application: 'foo',
        error: 'update jwt error'
      });
    });

    describe('before handler', function () {
      it('should run beforeHandler before handler', function () {
        var messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        handleJWT.updateJWT.and.returnValue('newJwtToken');

        var appModule = {
          beforeHandler: jasmine.createSpy().and.returnValue(true),
          handlers: {
            baz: jasmine.createSpy().and.callFake(function (messageObj, session, send, finalise) {
              finalise();
            })
          }
        };
        mockery.registerMock('foo', appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.beforeHandler).toHaveBeenCalledBefore(appModule.handlers.baz);
        expect(appModule.beforeHandler).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      });

      it('should do not run handler', function () {
        var messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        var appModule = {
          beforeHandler: jasmine.createSpy().and.returnValue(false),
          handlers: {
            baz: jasmine.createSpy()
          }
        };
        mockery.registerMock('foo', appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers.baz).not.toHaveBeenCalled();
        expect(finished).not.toHaveBeenCalled();
      });
    });

    describe('after handler', function () {
      it('should run afterHandler after handler', function () {
        var messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        handleJWT.updateJWT.and.returnValue('newJwtToken');

        var appModule = {
          afterHandler: jasmine.createSpy(),
          handlers: {
            baz: jasmine.createSpy().and.callFake(function (messageObj, session, send, finalise) {
              finalise();
            })
          }
        };
        mockery.registerMock('foo', appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers.baz).toHaveBeenCalledBefore(appModule.afterHandler);
        expect(appModule.afterHandler).toHaveBeenCalledWith(messageObj, session, send, jasmine.any(Function));
      });
    });

    it('should set jwt handlers', function () {
      var messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      handleJWT.updateJWT.and.returnValue('newJwtToken');

      var appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake(function (messageObj, session, send, finalise) {
            finalise();
          })
        }
      };
      mockery.registerMock('foo', appModule);

      worker.jwt = {};

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.jwt.handlers).toBe(handleJWT);
    });
  });

  describe('no type handler', function () {
    var application = 'foo';

    beforeEach(function () {
      var result = {
        session: {
          application: application
        }
      };
      handleJWT.validate.and.returnValue(result);

      var appModule = {};
      mockery.registerMock('foo', appModule);
    });

    it('should finished with standard error', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });

    it('should finished with custom error (string)', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      worker.errorMessages[application] = {
        'noTypeHandler': 'No handler type - custom error'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No handler type - custom error'
      });
    });

    it('should finished with custom error (object)', function () {
      var messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      worker.errorMessages[application] = {
        'noTypeHandler': {
          statusCode: 500,
          text: 'No handler type - custom error'
        }
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No handler type - custom error',
        status: {
          code: 500
        }
      });
    });
  });
});
