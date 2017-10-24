'use strict';

const rewire = require('rewire');
const jwtHandler = rewire('../../lib/jwtHandler');

describe('unit/jwtHandler:', () => {
  let Worker = null;
  let Master = null;
  let worker = null;
  let master = null;
  let jwt = null;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Worker = function () {
      this.jwt = {
        secret: 'jwtSecret'
      };
      this.userDefined = {
        config: {
          initialSessionTimeout: 300
        }
      };
    };

    Master = function () {
      this.log = true;
      this.u_services = {
        byApplication: {}
      };
      this.jwt = {
        secret: 'jwtSecret'
      };

      this.handleMessage = jasmine.createSpy();
    };
  });

  beforeEach(() => {
    jasmine.clock().install();

    worker = new Worker();
    master = new Master();

    jwt = jasmine.createSpyObj(['decode', 'encode']);
    jwt.__revert__ = jwtHandler.__set__('jwt', jwt);
  });

  afterEach(() => {
    jasmine.clock().uninstall();

    revert(jwt);
  });

  describe('decodeJWTInWorker', () => {
    let decodeJWTInWorker = null;

    beforeAll(() => {
      decodeJWTInWorker = jwtHandler.__get__('decodeJWTInWorker');
    });

    it('should decode jwt in worker', () => {
      const callback = jasmine.createSpy();

      decodeJWTInWorker.call(master, 'foo', callback);

      expect(master.handleMessage).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'ewd-jwt-decode',
          params: {
            jwt: 'foo'
          }
        }),
        callback
      );
    });
  });

  describe('encodeJWTInWorker', () => {
    let encodeJWTInWorker = null;

    beforeAll(() => {
      encodeJWTInWorker = jwtHandler.__get__('encodeJWTInWorker');
    });

    it('should encode jwt in worker', () => {
      const payload = {
        foo: 'bar'
      };
      const callback = jasmine.createSpy();

      encodeJWTInWorker.call(master, payload, callback);

      expect(master.handleMessage).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'ewd-jwt-encode',
          params: {
            payload: {
              foo: 'bar'
            }
          }
        }),
        callback
      );
    });
  });

  describe('sendToMicroService', () => {
    let sendToMicroService = null;
    let socketClient = null;
    let data = null;
    let application = null;
    let handleResponse = null;
    let encodeJWTInWorker = null;

    beforeAll(() => {
      sendToMicroService = jwtHandler.__get__('sendToMicroService');
    });

    beforeEach(() => {
      socketClient = {
        client: {
          send: jasmine.createSpy()
        }
      };
      data = {
        foo: 'bar'
      };
      application = 'baz';
      handleResponse = jasmine.createSpy();

      encodeJWTInWorker = jasmine.createSpy();
      encodeJWTInWorker.__revert__ = jwtHandler.__set__('encodeJWTInWorker', encodeJWTInWorker);
    });

    afterEach(() => {
      revert(encodeJWTInWorker);
    });

    it('should call socket client send method', () => {
      sendToMicroService.call(master, socketClient, data, application, handleResponse);

      expect(socketClient.client.send).toHaveBeenCalledWith(data, jasmine.any(Function));
    });

    it('should handle response with error', () => {
      const responseObj = {
        message: {
          error: 'foo'
        }
      };
      socketClient.client.send.and.callFake((data, cb) => cb(responseObj));

      sendToMicroService.call(master, socketClient, data, application, handleResponse);

      expect(handleResponse).toHaveBeenCalledWith({
        message: {
          error: 'foo'
        }
      });
    });

    it('should handle response with no token', () => {
      const responseObj = {
        message: {
          foo: 'bar'
        }
      };
      socketClient.client.send.and.callFake((data, cb) => cb(responseObj));

      sendToMicroService.call(master, socketClient, data, application, handleResponse);

      expect(handleResponse).toHaveBeenCalledWith({
        message: {
          foo: 'bar'
        }
      });
    });

    it('should not reset jwt token', () => {
      const responseObj = {
        message: {
          token: 'quux'
        }
      };
      socketClient.client.send.and.callFake((data, cb) => cb(responseObj));

      jwt.decode.and.returnValue({
        application: 'baz'
      });

      sendToMicroService.call(master, socketClient, data, application, handleResponse);

      expect(jwt.decode).toHaveBeenCalledWith('quux', null, true);
      expect(handleResponse).toHaveBeenCalledWith({
        message: {
          token: 'quux'
        }
      });
    });

    it('should reset jwt token', () => {
      const responseObj = {
        message: {
          token: 'quux'
        }
      };
      socketClient.client.send.and.callFake((data, cb) => cb(responseObj));

      jwt.decode.and.returnValue({
        application: 'foo'
      });

      const jwtObj = {
        message: {
          jwt: 'quuux'
        }
      };
      encodeJWTInWorker.and.callFake((msg, cb) => cb(jwtObj));

      sendToMicroService.call(master, socketClient, data, application, handleResponse);

      expect(jwt.decode).toHaveBeenCalledWith('quux', null, true);
      expect(encodeJWTInWorker).toHaveBeenCalledWithContext(master, {
        application: 'baz'
      }, jasmine.any(Function));
      expect(handleResponse).toHaveBeenCalledWith({
        message: {
          token: 'quuux'
        }
      });
    });
  });

  describe('masterRequest', () => {
    let data = null;
    let socket = null;
    let handleResponse = null;
    let sendToMicroService = null;
    let decodeJWTInWorker = null;
    let encodeJWTInWorker = null;

    beforeEach(() => {
      data = {
        type: 'foo',
        token: 'bar'
      };
      socket  = jasmine.createSpyObj(['emit']);
      handleResponse  = jasmine.createSpy();

      sendToMicroService = jasmine.createSpy();
      sendToMicroService.__revert__ = jwtHandler.__set__('sendToMicroService', sendToMicroService);

      decodeJWTInWorker = jasmine.createSpy();
      decodeJWTInWorker.__revert__ = jwtHandler.__set__('decodeJWTInWorker', decodeJWTInWorker);

      encodeJWTInWorker = jasmine.createSpy();
      encodeJWTInWorker.__revert__ = jwtHandler.__set__('encodeJWTInWorker', encodeJWTInWorker);
    });

    afterEach(() => {
      revert(sendToMicroService);
      revert(decodeJWTInWorker);
      revert(encodeJWTInWorker);
    });

    it('should return QEWD not configured to support JTW error', () => {
      delete master.jwt;

      jwtHandler.masterRequest.call(master, data, socket, handleResponse);

      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        type: 'foo',
        message: {
          error: 'QEWD has not been configured to support JWTs',
          disconnect: true
        }
      });
    });

    it('should return decode jwt error ', () => {
      const responseObj = {
        message: {
          error: 'some error'
        }
      };
      decodeJWTInWorker.and.callFake((msg, cb) => cb(responseObj));

      jwtHandler.masterRequest.call(master, data, socket, handleResponse);

      expect(decodeJWTInWorker).toHaveBeenCalledWithContext(master, 'bar', jasmine.any(Function));
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        type: 'foo',
        message: {
          error: 'some error',
          disconnect: true
        }
      });
    });

    it('should handle request locally', () => {
      const responseObj = {
        message: {
          payload: {
            application: 'baz'
          }
        }
      };
      decodeJWTInWorker.and.callFake((msg, cb) => cb(responseObj));

      jwtHandler.masterRequest.call(master, data, socket, handleResponse);

      expect(decodeJWTInWorker).toHaveBeenCalledWithContext(master, 'bar', jasmine.any(Function));
      expect(master.handleMessage).toHaveBeenCalledWith({
        type: 'foo',
        token: 'bar',
        jwt: true
      }, handleResponse);
    });

    it('should handle request by microservice without rewrite application name', () => {
      const socketClient = {
        application: 'baz',
        client: {
          send: jasmine.createSpy()
        }
      };
      master.u_services.byApplication.baz = {
        [data.type]: socketClient
      };

      const responseObj = {
        message: {
          payload: {
            application: 'baz'
          }
        }
      };
      decodeJWTInWorker.and.callFake((msg, cb) => cb(responseObj));

      jwtHandler.masterRequest.call(master, data, socket, handleResponse);

      expect(decodeJWTInWorker).toHaveBeenCalledWithContext(master, 'bar', jasmine.any(Function));
      expect(sendToMicroService).toHaveBeenCalledWithContext(master, socketClient, data, 'baz', handleResponse);
    });

    it('should handle request by microservice with rewrite application name', () => {
      const socketClient = {
        application: 'baz',
        client: {
          send: jasmine.createSpy()
        }
      };
      master.u_services.byApplication.quux = {
        [data.type]: socketClient
      };

      const responseObj1 = {
        message: {
          payload: {
            application: 'quux'
          }
        }
      };
      decodeJWTInWorker.and.callFake((msg, cb) => cb(responseObj1));

      const responseObj2 = {
        message: {
          jwt: 'jwtValue'
        }
      };
      encodeJWTInWorker.and.callFake((msg, cb) => cb(responseObj2));

      jwtHandler.masterRequest.call(master, data, socket, handleResponse);

      expect(decodeJWTInWorker).toHaveBeenCalledWithContext(master, 'bar', jasmine.any(Function));
      expect(encodeJWTInWorker).toHaveBeenCalledWithContext(master, {
        application: 'baz'
      }, jasmine.any(Function));
      expect(sendToMicroService).toHaveBeenCalledWithContext(master, socketClient, data, 'quux', handleResponse);
    });
  });

  describe('register', () => {
    let createJWT = null;

    beforeEach(() => {
      createJWT = jasmine.createSpy();
      createJWT.__revert__ = jwtHandler.__set__('createJWT', createJWT);
    });

    afterEach(() => {
      revert(createJWT);
    });

    it('should return QEWD not configured to support JTW error', () => {
      const messageObj = {
        jwt: 'foo'
      };

      delete master.jwt;

      const actual = jwtHandler.register.call(master, messageObj);

      expect(messageObj.jwt).toBeUndefined();
      expect(actual).toEqual({
        error: 'Application expects to use JWTs, but QEWD is not running with JWT support turned on',
        disconnect: true
      });
    });

    it('should call create jwt', () => {
      const messageObj = {
        jwt: 'foo'
      };

      createJWT.and.returnValue('bar');

      const actual = jwtHandler.register.call(master, messageObj);

      expect(createJWT).toHaveBeenCalledWithContext(master, messageObj);
      expect(actual).toEqual({
        token: 'bar'
      });
    });
  });

  describe('reregister', () => {
    let updateJWT = null;

    beforeEach(() => {
      updateJWT = jasmine.createSpy();
      updateJWT.__revert__ = jwtHandler.__set__('updateJWT', updateJWT);
    });

    afterEach(() => {
      revert(updateJWT);
    });

    it('should update jwt', () => {
      const payload = {
        foo: 'bar'
      };

      updateJWT.and.returnValue('baz');

      const actual = jwtHandler.reregister.call(master, payload);

      expect(updateJWT).toHaveBeenCalledWithContext(master, payload);
      expect(actual).toEqual({
        ok: true,
        token: 'baz'
      });
    });
  });

  describe('createJWT', () => {
    it('should create jwt', () => {
      const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
      jasmine.clock().mockDate(new Date(nowTime));

      const messageObj = {
        application: 'foo',
        socketId: '/#yf_vd-S9Q7e-LX28AAAS',
        ipAddress: '127.0.0.1'
      };

      jwt.encode.and.returnValue('jwtToken');

      const actual = jwtHandler.createJWT.call(worker, messageObj);

      expect(jwt.encode).toHaveBeenCalledWith({
        exp: 1483229100,
        iat: 1483228800,
        iss: 'qewd.jwt',
        application: 'foo',
        timeout: 300,
        qewd: 'bf63524746e477330ea1e2de9b40593b841ddad00d3097815f61cb0ed9cb6051c4b3bd54e0b8657debf79b3abcceed01a176b8fbdaa48f1efd48e47a0ed2fd1f6eef7ce16a71e376d984b9f91d833f5c9290c2dd3d69e75f92cbba776ce8901b967382a2b8486a3e'
      }, 'jwtSecret');
      expect(actual).toBe('jwtToken');
    });
  });

  describe('createRestSession', () => {
    let args = null;

    beforeEach(() => {
      const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
      jasmine.clock().mockDate(new Date(nowTime));

      args = {
        req: {
          application: 'foo',
          ip: '127.0.0.1'
        }
      };
    });

    it('should return rest session', () => {
      const expected = {
        iat: 1483228800,
        iss: 'qewd.jwt',
        application: 'foo',
        ipAddress: '127.0.0.1',
        timeout: 300,
        authenticated: false,
        qewd: {
        },
        qewd_list: {
          ipAddress: true,
          authenticated: true
        }
      };

      const actual = jwtHandler.createRestSession.call(worker, args);

      expect(actual).toEqual(jasmine.objectContaining(expected));
    });

    it('should make public', () => {
      const name = 'ipAddress';
      const actual = jwtHandler.createRestSession.call(worker, args);

      actual.makePublic(name);
      expect(actual.isSecret(name)).toBeFalsy();
    });

    it('should make secret', () => {
      const name = 'socketId';
      const actual = jwtHandler.createRestSession.call(worker, args);

      actual.makeSecret(name);
      expect(actual.isSecret(name)).toBeTruthy();
    });
  });

  describe('updateJWT', () => {
    let payload = null;

    beforeEach(() => {
      const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
      jasmine.clock().mockDate(new Date(nowTime));

      payload = {
        exp: nowTime / 1000 - 3 * 60, // 1483228980, 3 mins ahead
        iat: nowTime / 1000 - 2 * 60, // 1483228680, 2 mins ago
        iss: 'qewd.jwt',
        application: 'foo',
        timeout: 300,
        qewd: {
          socketId: '/#yf_vd-S9Q7e-LX28AAAS',
          ipAddress: '127.0.0.1',
          authenticated: false
        },
        qewd_list: {
          socketId: true,
          ipAddress: true,
          authenticated: true,
          bar: 'quux'
        },
        socketId: '/#yf_vd-S9Q7e-LX28AAAS',
        ipAddress: '127.0.0.1',
        authenticated: false,
        makeSecret: jasmine.createSpy(),
        isSecret: jasmine.createSpy(),
        makePublic: jasmine.createSpy()
      };
    });

    it('should update expiry time', () => {
      [
        'qewd',
        'qewd_list',
        'makeSecret',
        'isSecret',
        'makePublic',
        'makeSecret',
        'ipAddress',
        'socketId',
        'authenticated',
      ].forEach(x => delete payload[x]);

      jwt.encode.and.returnValue('jwtToken');

      const actual = jwtHandler.updateJWT.call(worker, payload);

      expect(jwt.encode).toHaveBeenCalledWith({
        exp: 1483229100,
        iat: 1483228800,
        iss: 'qewd.jwt',
        application: 'foo',
        timeout: 300,
      }, 'jwtSecret');
      expect(actual).toBe('jwtToken');
    });

    it('should encrypt secret data', () => {
      jwt.encode.and.returnValue('jwtToken');

      jwtHandler.updateJWT.call(worker, payload);

      expect(jwt.encode).toHaveBeenCalledWith({
        exp: 1483229100,
        iat: 1483228800,
        iss: 'qewd.jwt',
        application: 'foo',
        timeout: 300,
        qewd: 'bf63524746e477330ea1e2de9b40593b841ddad00d3097815f61cb0ed9cb6051c4b3bd54e0b8657debf79b3abcceed01a176b8fbdaa48f1efd48e47a0ed2fd1f6eef7ce16a71e376d984b9f91d833f5c929093'
      }, 'jwtSecret');
    });
  });

  describe('setJWT', () => {
    it('should be reference to updateJWT', () => {
      expect(jwtHandler.setJWT).toBe(jwtHandler.updateJWT);
    });
  });

  describe('validate', () => {
    let payload = null;

    beforeEach(() => {
      payload = {
        exp: 1483229100,
        iat: 1483228800,
        iss: 'qewd.jwt',
        application: 'foo',
        timeout: 300,
        qewd: 'bf63524746e477330ea1e2de9b40593b841ddad00d3097815f61cb0ed9cb6051c4b3bd54e0b8657debf79b3abcceed01a176b8fbdaa48f1efd48e47a0ed2fd1f6eef7ce16a71e376d984b9f91d833f5c9290c2dd3d69e75f92cbba776ce8901b967382a2b8486a3e'
      };
    });

    it('should return invalid jwt error', () => {
      const messageObj = {
        token: 'jwtToken'
      };

      jwt.decode.and.throwError(new Error('some error'));

      const actual = jwtHandler.validate.call(worker, messageObj);

      expect(actual).toEqual({
        error: 'Invalid JWT: Error: some error',
        status: {
          code: 403,
          text: 'Forbidden'
        }
      });
    });

    it('should return session', () => {
      const messageObj = {
        token: 'jwtToken'
      };

      jwt.decode.and.returnValue(payload);

      const actual = jwtHandler.validate.call(worker, messageObj);

      expect(actual).toEqual({
        session: {
          exp: 1483229100,
          iat: 1483228800,
          iss: 'qewd.jwt',
          application: 'foo',
          timeout: 300,
          qewd: {
            socketId: '/#yf_vd-S9Q7e-LX28AAAS',
            ipAddress: '127.0.0.1',
            authenticated: false,
            application: 'quux'
          },
          qewd_list: {
            socketId: true,
            ipAddress: true,
            authenticated: true
          },
          socketId: '/#yf_vd-S9Q7e-LX28AAAS',
          ipAddress: '127.0.0.1',
          authenticated: false,
          makeSecret: jasmine.any(Function),
          isSecret: jasmine.any(Function),
          makePublic: jasmine.any(Function)
        }
      });
    });

    it('should make public', () => {
      const name = 'ipAddress';
      const messageObj = {
        token: 'jwtToken'
      };

      jwt.decode.and.returnValue(payload);

      const actual = jwtHandler.validate.call(worker, messageObj);
      const session = actual.session;

      session.makePublic(name);
      expect(session.isSecret(name)).toBeFalsy();
    });

    it('should make secret', () => {
      const name = 'ipAddress';
      const messageObj = {
        token: 'jwtToken'
      };

      jwt.decode.and.returnValue(payload);

      const actual = jwtHandler.validate.call(worker, messageObj);
      const session = actual.session;

      session.makeSecret('socketId');
      expect(session.isSecret(name)).toBeTruthy();
    });
  });

  describe('getRestJWT', () => {
    it('return empty string', () => {
      const messageObj = {};

      const actual = jwtHandler.getRestJWT(messageObj);

      expect(actual).toBe('');
    });

    it('should return bearer token', () => {
      const messageObj = {
        headers: {
          authorization: 'Bearer foo'
        }
      };

      const actual = jwtHandler.getRestJWT(messageObj);

      expect(actual).toBe('foo');
    });

    it('should return empty string when bearer token invalid', () => {
      const messageObj = {
        headers: {
          authorization: 'bar'
        }
      };

      const actual = jwtHandler.getRestJWT(messageObj);

      expect(actual).toBe('');
    });

    it('should return authorization header', () => {
      const messageObj = {
        headers: {
          authorization: 'baz'
        }
      };

      const actual = jwtHandler.getRestJWT(messageObj, false);

      expect(actual).toBe('baz');
    });

    // it('should return token', () => {
    //   var messageObj = {
    //     headers: {
    //       authorization: 'Bearer foo'
    //     }
    //   };

    //   var actual = jwtHandler.getRestJWT(messageObj, false);

    //   expect(actual).toBe('foo');
    // });
  });

  describe('validateRestRequest', () => {
    let getRestJWT = null;
    let validate = null;

    beforeEach(() => {
      getRestJWT = jasmine.createSpy();
      getRestJWT.__revert__ = jwtHandler.__set__('getRestJWT', getRestJWT);

      validate = jasmine.createSpy();
      validate.__revert__ = jwtHandler.__set__('validate', validate);
    });

    afterEach(() => {
      revert(getRestJWT);
      revert(validate);
    });

    it('should return authorization header missing error', () => {
      const messageObj = {};
      const finished = jasmine.createSpy();
      const bearer = true;

      getRestJWT.and.returnValue('');

      const actual = jwtHandler.validateRestRequest.call(worker, messageObj, finished, bearer);

      expect(getRestJWT).toHaveBeenCalledWith(messageObj, bearer);
      expect(finished).toHaveBeenCalledWith({
        error: 'Authorization Header missing or JWT not found in header (expected format: Bearer {{JWT}}'
      });
      expect(actual).toBeFalsy();
    });

    it('should return with validate error', () => {
      const messageObj = {};
      const finished = jasmine.createSpy();
      const bearer = true;

      getRestJWT.and.returnValue('foo');
      validate.and.returnValue({
        error: 'some error'
      });

      const actual = jwtHandler.validateRestRequest.call(worker, messageObj, finished, bearer);

      expect(getRestJWT).toHaveBeenCalledWith(messageObj, bearer);
      expect(validate).toHaveBeenCalledWithContext(worker, {
        token: 'foo'
      });
      expect(finished).toHaveBeenCalledWith({
        error: 'some error'
      });
      expect(actual).toBeFalsy();
    });

    it('should return user not authenticated error', () => {
      const messageObj = {};
      const finished = jasmine.createSpy();
      const bearer = true;

      getRestJWT.and.returnValue('foo');
      validate.and.returnValue({
        session: {
          authenticated: false
        }
      });

      const actual = jwtHandler.validateRestRequest.call(worker, messageObj, finished, bearer);

      expect(getRestJWT).toHaveBeenCalledWith(messageObj, bearer);
      expect(validate).toHaveBeenCalledWithContext(worker, {
        token: 'foo'
      });
      expect(finished).toHaveBeenCalledWith({
        error: 'User is not authenticated'
      });
      expect(actual).toBeFalsy();
    });

    it('should set session', () => {
      const messageObj = {};
      const finished = jasmine.createSpy();
      const bearer = true;

      getRestJWT.and.returnValue('foo');
      validate.and.returnValue({
        session: {
          authenticated: true
        }
      });

      const actual = jwtHandler.validateRestRequest.call(worker, messageObj, finished, bearer);

      expect(getRestJWT).toHaveBeenCalledWith(messageObj, bearer);
      expect(validate).toHaveBeenCalledWithContext(worker, {
        token: 'foo'
      });
      expect(finished).not.toHaveBeenCalled();
      expect(actual).toBeTruthy();
      expect(messageObj).toEqual({
        session: {
          authenticated: true
        }
      });
    });

    it('should set session when no check authenticated', () => {
      const messageObj = {};
      const finished = jasmine.createSpy();
      const bearer = true;
      const checkIfAuthenticated = false;

      getRestJWT.and.returnValue('foo');
      validate.and.returnValue({
        session: {
          authenticated: false
        }
      });

      const actual = jwtHandler.validateRestRequest.call(worker, messageObj, finished, bearer, checkIfAuthenticated);

      expect(getRestJWT).toHaveBeenCalledWith(messageObj, bearer);
      expect(validate).toHaveBeenCalledWithContext(worker, {
        token: 'foo'
      });
      expect(finished).not.toHaveBeenCalled();
      expect(actual).toBeTruthy();
      expect(messageObj).toEqual({
        session: {
          authenticated: false
        }
      });
    });
  });

  describe('updateJWTExpiry', () => {
    beforeEach(() => {
      const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
      jasmine.clock().mockDate(new Date(nowTime));
    });

    it('should return false', () => {
      jwt.decode.and.throwError();

      const actual = jwtHandler.updateJWTExpiry.call(worker, 'jwtToken', 'foo');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', null, true);
      expect(actual).toBeFalsy();
    });

    it('should return token', () => {
      jwt.decode.and.returnValue({});

      jwt.encode.and.returnValue('jwtUpdatedToken');

      const actual = jwtHandler.updateJWTExpiry.call(worker, 'jwtToken');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', null, true);
      expect(jwt.encode).toHaveBeenCalledWith({
        iat: 1483228800,
        exp: 1483229100
      }, 'jwtSecret');
      expect(actual).toBe('jwtUpdatedToken');
    });

    it('should update application in payload', () => {
      jwt.decode.and.returnValue({
        application: 'foo'
      });

      jwtHandler.updateJWTExpiry.call(worker, 'jwtToken', 'bar');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', null, true);
      expect(jwt.encode).toHaveBeenCalledWith({
        application: 'bar',
        iat: 1483228800,
        exp: 1483229100
      }, 'jwtSecret');
    });

    it('should use custom timeout to update exp in payload', () => {
      jwt.decode.and.returnValue({
        timeout: 500
      });

      jwtHandler.updateJWTExpiry.call(worker, 'jwtToken');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', null, true);
      expect(jwt.encode).toHaveBeenCalledWith({
        timeout: 500,
        iat: 1483228800,
        exp: 1483229300
      }, 'jwtSecret');
    });
  });

  describe('isTokenAPossibleJWT', () => {
    let isTokenAPossibleJWT = null;

    beforeAll(() => {
      isTokenAPossibleJWT = jwtHandler.__get__('isTokenAPossibleJWT');
    });

    it('should return true', () => {
      const token = 'foo.bar.baz';

      const actual = isTokenAPossibleJWT(token);

      expect(actual).toBeTruthy();
    });

    it('should return false', () => {
      const tokens = [
        'foo.bar',
        'foo.bar.baz.quux',
        'f.bar.baz',
        'foo.b.baz',
        'foo.bar.b'
      ];

      tokens.forEach(x => {
        const actual = isTokenAPossibleJWT(x);
        expect(actual).toBeFalsy();
      });
    });
  });

  describe('isJWTValid', () => {
    it('should return error', () => {
      jwt.decode.and.throwError(new Error('some error'));

      const actual = jwtHandler.isJWTValid.call(worker, 'jwtToken');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret', undefined);
      expect(actual).toEqual({
        ok: false,
        error: 'Invalid JWT: Error: some error'
      });
    });

    it('should return payload without verify', () => {
      jwt.decode.and.returnValue({
        foo: 'bar'
      });

      const actual = jwtHandler.isJWTValid.call(worker, 'jwtToken', false);

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret', false);
      expect(actual).toEqual({
        ok: true
      });
    });

    describe('with verify', () => {
      let nowTime = null;

      beforeEach(() => {
        nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
        jasmine.clock().mockDate(new Date(nowTime));
      });

      it('should return error', () => {
        jwt.decode.and.returnValue({
          foo: 'bar',
          exp: (nowTime / 1000) - 5 * 60 * 50 // time in the past
        });

        const actual = jwtHandler.isJWTValid.call(worker, 'jwtToken', true);

        expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret', true);
        expect(actual).toEqual({
          ok: false,
          error: 'Invalid JWT: Token expired'
        });
      });

      it('should return payload', () => {
        jwt.decode.and.returnValue({
          foo: 'bar',
          exp: (nowTime / 1000) + 5 * 60 * 50 // time in the future
        });

        const actual = jwtHandler.isJWTValid.call(worker, 'jwtToken', true);

        expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret', true);
        expect(actual).toEqual({
          ok: true
        });
      });
    });
  });

  describe('createUServiceSession', () => {
    it('should call createRestSession with correct args', () => {
      const messageObj = {
        application: 'foo',
        ip: '192.168.1.1'
      };

      const session = {};
      const createRestSession = jasmine.createSpy().and.returnValue(session);
      createRestSession.__revert__ = jwtHandler.__set__('createRestSession', createRestSession);

      const actual = jwtHandler.createUServiceSession.call(worker, messageObj);

      expect(createRestSession).toHaveBeenCalledWithContext(worker, {
        req: {
          application: 'foo',
          ip: '192.168.1.1'
        }
      });
      expect(actual).toBe(session);
    });
  });

  describe('decodeJWT', () => {
    it('should return error', () => {
      jwt.decode.and.throwError(new Error('some error'));

      const actual = jwtHandler.decodeJWT.call(worker, 'jwtToken');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret');
      expect(actual).toEqual({
        error: 'Invalid JWT: Error: some error'
      });
    });

    it('should return payload', () => {
      jwt.decode.and.returnValue({
        foo: 'bar'
      });

      const actual = jwtHandler.decodeJWT.call(worker, 'jwtToken');

      expect(jwt.decode).toHaveBeenCalledWith('jwtToken', 'jwtSecret');
      expect(actual).toEqual({
        payload: {
          foo: 'bar'
        }
      });
    });
  });

  describe('encodeJWT', () => {
    it('should return token', () => {
      jwt.encode.and.returnValue('jwtToken');

      const payload = {
        foo: 'bar'
      };
      const actual = jwtHandler.encodeJWT.call(worker, payload);

      expect(jwt.encode).toHaveBeenCalledWith({
        foo: 'bar'
      }, 'jwtSecret');
      expect(actual).toEqual('jwtToken');
    });
  });

  describe('getProperty', () => {
    it('should return false when error', () => {
      jwt.decode.and.throwError('some error');

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBeFalsy();
    });

    it('should return false when no property', () => {
      jwt.decode.and.returnValue({
        bar: 'baz'
      });

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBeFalsy();
    });

    it('should return correct value', () => {
      jwt.decode.and.returnValue({
        foo: 'bar'
      });

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBe('bar');
    });

    it('should return empty string value', () => {
      jwt.decode.and.returnValue({
        foo: ''
      });

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBe('');
    });

    it('should return null value', () => {
      jwt.decode.and.returnValue({
        foo: null
      });

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBe(null);
    });

    it('should return bool value (false)', () => {
      jwt.decode.and.returnValue({
        foo: false
      });

      const actual = jwtHandler.getProperty('foo', 'jwtToken');

      expect(actual).toBe(false);
    });
  });
});
