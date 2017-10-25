'use strict';

const events = require('events');
const mockery = require('mockery');
const rewire = require('rewire');
const dbMock = require('./mocks/db');
const documentStoreMock = require('./mocks/documentStore');
const sessionsMock = require('./mocks/sessions');
const appHandler = rewire('../../lib/appHandler');
const loadModuleSpec = require('./shared/loadModuleSpec');

describe('unit/appHandler:', () => {
  let Worker;
  let worker;
  let db;
  let documentStore;
  let sessions;
  let send;
  let finished;
  let handleJWT;
  let getFragment;
  let resilientMode;
  let session;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };
  const boot = (cb) => cb(appHandler, worker, send, finished);

  beforeAll(() => {
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

  afterAll(() => {
    mockery.disable();
  });

  beforeEach(() => {
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

  afterEach(() => {
    revert(handleJWT);
    revert(resilientMode);

    mockery.deregisterAll();
  });

  it('should add message event handler', () => {
    spyOn(worker, 'on');

    appHandler.call(worker);

    expect(worker.on).toHaveBeenCalledWith('message', jasmine.any(Function));
  });

  describe('resilientMode', () => {
    beforeEach(() => {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should update worker status to started/error', () => {
      const messageObj = {
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
      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledWithContext(worker, messageObj, 'started');
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(0)).toEqual(jasmine.arrayContaining(['started']));
      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledWithContext(worker, messageObj, 'error');
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(1)).toEqual(jasmine.arrayContaining(['error']));
      expect(finished).toHaveBeenCalledWith({
        error: 'decodeJWT internal error'
      });
    });

    it('should update worker status to started/finished', () => {
      const messageObj = {
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
      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledWithContext(worker, messageObj, 'started');
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(0)).toEqual(jasmine.arrayContaining(['started']));
      expect(resilientMode.storeWorkerStatusUpdate).toHaveBeenCalledWithContext(worker, messageObj, 'started');
      expect(resilientMode.storeWorkerStatusUpdate.calls.argsFor(1)).toEqual(jasmine.arrayContaining(['finished']));
      expect(finished).toHaveBeenCalledWith({
        foo: 'bar'
      });
    });
  });

  describe('no documentStore defined', () => {
    beforeEach(() => {
      delete worker.documentStore;
    });

    it('should finished with standard error', () => {
      const messageObj = {};

      appHandler.call(worker);

      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No Document Store has been created - you must use ewd-document-store!'
      });
    });

    it('should finished with custom error (string)', () => {
      const messageObj = {
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

    it('should finished with custom error (object)', () => {
      const messageObj = {
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

  describe('ewd-jwt-decode', () => {
    it('should handle message', () => {
      const messageObj = {
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

      expect(handleJWT.decodeJWT).toHaveBeenCalledWithContext(worker, 'jwtToken');
      expect(finished).toHaveBeenCalledWith({
        foo: 'bar'
      });
    });
  });

  describe('ewd-jwt-encode', () => {
    it('should handle message', () => {
      const messageObj = {
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

      expect(handleJWT.encodeJWT).toHaveBeenCalledWithContext(worker, {
        bar: 'baz'
      });
      expect(finished).toHaveBeenCalledWith({
        jwt: 'jwtToken'
      });
    });
  });

  describe('ewd-jwt-updateExpiry', () => {
    it('should handle message', () => {
      const messageObj = {
        type: 'ewd-jwt-updateExpiry',
        params: {
          jwt: 'jwtToken',
          application: 'foo'
        }
      };

      handleJWT.updateJWTExpiry.and.returnValue('jwtTokenUpdated');

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.updateJWTExpiry).toHaveBeenCalledWithContext(worker, 'jwtToken', 'foo');
      expect(finished).toHaveBeenCalledWith({
        jwt: 'jwtTokenUpdated'
      });
    });
  });

  describe('ewd-jwt-isValid', () => {
    it('should handle message', () => {
      const messageObj = {
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

      expect(handleJWT.isJWTValid).toHaveBeenCalledWithContext(worker, 'jwtToken');
      expect(finished).toHaveBeenCalledWith({
        ok: true
      });
    });
  });

  describe('ewd-qoper8-express', () => {
    const application = 'baz';
    let messageObj;

    beforeEach(() => {
      worker.restModule[application] = true;

      messageObj = {
        type: 'ewd-qoper8-express',
        application: application
      };
    });

    loadModuleSpec(mockery, boot, {
      moduleName: application,
      onMessage: () => messageObj,
      onSuccess: () => {
        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for baz messages of type ewd-qoper8-express'
        });
      }
    });

    describe('rest module', () => {
      describe('no handler type', () => {
        it('should finished with standard error', () => {
          worker.handlers[messageObj.application] = {};

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(finished).toHaveBeenCalledWith({
            error: 'No handler defined for baz messages of type ewd-qoper8-express'
          });
        });

        it('should finished with custom error (string)', () => {
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

        it('should finished with custom error (object)', () => {
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

      it('should call application handler', () => {
        const appModule = {
          handlers: {
            'ewd-qoper8-express': jasmine.createSpy().and.callFake((messageObj, finalise) => finalise())
          }
        };
        mockery.registerMock(application, appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers[messageObj.type]).toHaveBeenCalledWithContext(worker, messageObj, jasmine.any(Function));
        expect(finished).toHaveBeenCalledWith({
          ewd_application: 'baz',
          restMessage: true
        });
      });

      describe('before handler', () => {
        it('should run beforeHandler before handler', () => {
          const appModule = {
            beforeHandler: jasmine.createSpy().and.returnValue(true),
            handlers: {
              'ewd-qoper8-express': jasmine.createSpy().and.callFake((messageObj, finalise) => finalise())
            }
          };
          mockery.registerMock(application, appModule);

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(appModule.beforeHandler).toHaveBeenCalledBefore(appModule.handlers[messageObj.type]);
          expect(appModule.beforeHandler).toHaveBeenCalledWithContext(worker, messageObj, jasmine.any(Function));
        });

        it('should do not run handler', () => {
          const appModule = {
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

      describe('after handler', () => {
        it('should run afterHandler after handler', () => {
          const appModule = {
            afterHandler: jasmine.createSpy(),
            handlers: {
              'ewd-qoper8-express': jasmine.createSpy().and.callFake((messageObj, finalise) => finalise())
            }
          };
          mockery.registerMock(application, appModule);

          appHandler.call(worker);
          worker.emit('message', messageObj, send, finished);

          expect(appModule.handlers[messageObj.type]).toHaveBeenCalledBefore(appModule.afterHandler);
          expect(appModule.afterHandler).toHaveBeenCalledWithContext(worker, messageObj, jasmine.any(Function));
        });
      });

      it('should set jwt handlers', () => {
        const appModule = {
          handlers: {
            'ewd-qoper8-express': jasmine.createSpy().and.callFake((messageObj, finalise) => finalise())
          }
        };
        mockery.registerMock(application, appModule);

        worker.jwt = {};

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(worker.jwt.handlers).toBe(handleJWT);
      });
    });

    describe('ajax', () => {
      it('should handle ajax message', () => {
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

        const appModule = {
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

      it('should handle message with ewd-register type in body', () => {
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

    describe('express type', () => {
      it('should replace type to expressType', () => {
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

  describe('ewd-register', () => {
    it('should handle message with jwt token', () => {
      const messageObj = {
        type: 'ewd-register',
        jwt: 'jwtToken'
      };

      handleJWT.register.and.returnValue('foobar');

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.register).toHaveBeenCalledWithContext(worker, messageObj);
      expect(finished).toHaveBeenCalledWith('foobar');
    });

    it('should handle message without jwt token', () => {
      const messageObj = {
        type: 'ewd-register',
        application: 'foo'
      };
      const session = {
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

    it('should handle message without jwt token but with additional props', () => {
      const messageObj = {
        type: 'ewd-register',
        application: 'foo',
        socketId: '/#yf_vd-S9Q7e-LX28AAAS',
        ipAddress: '127.0.0.1'
      };
      const session = {
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

  describe('auth', () => {
    it('should return error when jwt is invalid', () => {
      const messageObj = {
        type: '*',
        jwt: 'invalid-jwt'
      };

      handleJWT.validate.and.returnValue({
        error: 'jwt is invalid'
      });

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWithContext(worker, messageObj);
      expect(finished).toHaveBeenCalledWith({
        error: 'jwt is invalid',
        disconnect: true
      });
    });

    it('should authenticate with jwt', () => {
      const messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      const result = {
        session: {
          application: 'foo'
        }
      };
      handleJWT.validate.and.returnValue(result);

      worker.handlers[result.session.application] = {};

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWithContext(worker, messageObj);
      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });

    it('should return error when session token is invalid', () => {
      const messageObj = {
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

    it('should authenticate with session token', () => {
      const messageObj = {
        type: '*',
        token: 'tokenValue'
      };

      const result = {
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

    it('should return custom error (string)', () => {
      const messageObj = {
        type: '*',
        token: 'invalid-token',
        application: 'foo'
      };

      const result = {
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

  describe('ewd-reregister', () => {
    beforeEach(() => {
      session = {
        socketId: 'socket-id'
      };
    });

    it('should handle message with jwt', () => {
      const messageObj = {
        type: 'ewd-reregister',
        jwt: 'jwtToken'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });

      const result = {
        ok: true,
        token: 'tokenValue'
      };
      handleJWT.reregister.and.returnValue(result);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWithContext(worker, messageObj);
      expect(handleJWT.reregister).toHaveBeenCalledWithContext(worker, session, messageObj);
      expect(finished).toHaveBeenCalledWith({
        ok: true,
        token: 'tokenValue'
      });
    });

    it('should handle message with session token', () => {
      const messageObj = {
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

  describe('ewd-fragment', () => {
    beforeEach(() => {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should handle message with jwt', () => {
      const messageObj = {
        type: 'ewd-fragment',
        jwt: 'jwtToken'
      };

      const result = {
        session: {
          application: 'foo'
        }
      };
      handleJWT.validate.and.returnValue(result);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handleJWT.validate).toHaveBeenCalledWithContext(worker, messageObj);
      expect(getFragment).toHaveBeenCalledWithContext(worker, messageObj, 'foo', finished);
    });

    it('should handle message with session token', () => {
      const messageObj = {
        type: 'ewd-fragment',
        token: 'tokenValue'
      };

      const result = {
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
      expect(getFragment).toHaveBeenCalledWithContext(worker, messageObj, 'foo', finished);
    });

    describe('should handle message with service prop', () => {
      let messageObj;

      beforeEach(() => {
        messageObj = {
          type: 'ewd-fragment',
          jwt: 'jwtToken',
          service: 'baz'
        };
      });

      loadModuleSpec(mockery, boot, {
        moduleName: 'foo',
        onMessage: () => messageObj,
        onSuccess: () => {
          expect(getFragment).toHaveBeenCalledWithContext(worker, messageObj, session.application, finished);
        },
        onError: () => {
          expect(getFragment).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('application handler', () => {
    let messageObj;

    beforeEach(() => {
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
      onMessage: () => messageObj,
      onSuccess: () => {
        expect(finished).toHaveBeenCalledWith({
          error: 'No handler defined for foo messages of type *'
        });
      }
    });
  });

  describe('session locking', () => {
    beforeEach(() => {
      session = {
        id: 'baz',
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should return error when session timed out', () => {
      const messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '0'
      });

      const appModule = {};
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

    it('should use custom session timeout value', () => {
      const messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '0'
      });

      const appModule = {};
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

    it('should pass session locking', () => {
      const messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      db.lock.and.returnValue({
        result: '1'
      });

      const appModule = {};
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

  describe('service request', () => {
    let session;
    const application = 'foo';
    const service = 'baz';

    beforeEach(() => {
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

    describe('service not allowed error', () => {
      beforeEach(() => {
        delete session.allowedServices[service];
      });

      it('should finished with standard error', () => {
        const messageObj = {
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

      it('should finished with custom error (string)', () => {
        const messageObj = {
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

    describe('service not allowed error for user', () => {
      beforeEach(() => {
        session.allowedServices[service] = false;
      });

      it('should finished with standard error', () => {
        const messageObj = {
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

      it('should finished with custom error (string)', () => {
        const messageObj = {
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

    describe('service handler', () => {
      let messageObj;

      beforeEach(() => {
        messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        delete worker.handlers[service];
      });

      loadModuleSpec(mockery, boot, {
        moduleName: service,
        onMessage: () => messageObj
      });
    });

    describe('no service module type', () => {
      it('should finished with standard error', () => {
        const messageObj = {
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

      it('should finished with custom error (string)', () => {
        const messageObj = {
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

    it('should call service handler', () => {
      const messageObj = {
        type: 'bar',
        service: service,
        jwt: 'jwtToken'
      };

      const handler = jasmine.createSpy();
      worker.handlers[service][messageObj.type] = handler;

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(handler).toHaveBeenCalledWithContext(worker, messageObj, session, send, finished);
    });

    describe('before handler', () => {
      it('should run beforeHandler before handler', () => {
        const messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        const handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        const beforeHandler = jasmine.createSpy();
        worker.beforeHandlers[service] = beforeHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(beforeHandler).toHaveBeenCalledBefore(handler);
        expect(beforeHandler).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      });

      it('should do not run handler', () => {
        const messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        const handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        const beforeHandler = jasmine.createSpy().and.returnValue(false);
        worker.beforeHandlers[service] = beforeHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('after handler', () => {
      it('should run afterHandler after handler', () => {
        const messageObj = {
          type: 'bar',
          service: service,
          jwt: 'jwtToken'
        };

        const handler = jasmine.createSpy();
        worker.handlers[service][messageObj.type] = handler;

        const afterHandler = jasmine.createSpy();
        worker.afterHandlers[service] = afterHandler;

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(handler).toHaveBeenCalledBefore(afterHandler);
        expect(afterHandler).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      });
    });
  });

  describe('application request', () => {
    let session;

    beforeEach(() => {
      session = {
        application: 'foo'
      };

      handleJWT.validate.and.returnValue({
        session: session
      });
    });

    it('should call application handler', () => {
      const messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      handleJWT.updateJWT.and.returnValue('newJwtToken');

      const appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake((messageObj, session, send, finalise) => finalise())
        }
      };
      mockery.registerMock('foo', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.handlers.baz).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      expect(handleJWT.updateJWT).toHaveBeenCalledWithContext(worker, session);
      expect(finished).toHaveBeenCalledWith({
        ewd_application: 'foo',
        token: 'newJwtToken'
      });
    });

    it('should call application handler and handle error', () => {
      const messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      const appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake((messageObj, session, send, finalise) => finalise({error: 'update jwt error'}))
        }
      };
      mockery.registerMock('foo', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.handlers.baz).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      expect(handleJWT.updateJWT).not.toHaveBeenCalled();
      expect(finished).toHaveBeenCalledWith({
        ewd_application: 'foo',
        error: 'update jwt error'
      });
    });

    describe('before handler', () => {
      it('should run beforeHandler before handler', () => {
        const messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        handleJWT.updateJWT.and.returnValue('newJwtToken');

        const appModule = {
          beforeHandler: jasmine.createSpy().and.returnValue(true),
          handlers: {
            baz: jasmine.createSpy().and.callFake((messageObj, session, send, finalise) => finalise())
          }
        };
        mockery.registerMock('foo', appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.beforeHandler).toHaveBeenCalledBefore(appModule.handlers.baz);
        expect(appModule.beforeHandler).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      });

      it('should do not run handler', () => {
        const messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        const appModule = {
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

    describe('after handler', () => {
      it('should run afterHandler after handler', () => {
        const messageObj = {
          type: 'baz',
          jwt: 'jwtToken'
        };

        handleJWT.updateJWT.and.returnValue('newJwtToken');

        const appModule = {
          afterHandler: jasmine.createSpy(),
          handlers: {
            baz: jasmine.createSpy().and.callFake((messageObj, session, send, finalise) => finalise())
          }
        };
        mockery.registerMock('foo', appModule);

        appHandler.call(worker);
        worker.emit('message', messageObj, send, finished);

        expect(appModule.handlers.baz).toHaveBeenCalledBefore(appModule.afterHandler);
        expect(appModule.afterHandler).toHaveBeenCalledWithContext(worker, messageObj, session, send, jasmine.any(Function));
      });
    });

    it('should set jwt handlers', () => {
      const messageObj = {
        type: 'baz',
        jwt: 'jwtToken'
      };

      handleJWT.updateJWT.and.returnValue('newJwtToken');

      const appModule = {
        handlers: {
          baz: jasmine.createSpy().and.callFake((messageObj, session, send, finalise) => finalise())
        }
      };
      mockery.registerMock('foo', appModule);

      worker.jwt = {};

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.jwt.handlers).toBe(handleJWT);
    });
  });

  describe('no type handler', () => {
    const application = 'foo';

    beforeEach(() => {
      const result = {
        session: {
          application: application
        }
      };
      handleJWT.validate.and.returnValue(result);

      const appModule = {};
      mockery.registerMock('foo', appModule);
    });

    it('should finished with standard error', () => {
      const messageObj = {
        type: '*',
        jwt: 'jwtToken'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'No handler defined for foo messages of type *'
      });
    });

    it('should finished with custom error (string)', () => {
      const messageObj = {
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

    it('should finished with custom error (object)', () => {
      const messageObj = {
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
