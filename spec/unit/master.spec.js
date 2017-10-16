'use strict';

const events = require('events');
const mockery = require('mockery');
const rewire = require('rewire');
const qewd = rewire('../../lib/master');
const dbMock = rewire('./mocks/db');

describe('unit/master:', () => {
  let Master = null;
  let master = null;
  let qx = null;
  let qxKoa = null;
  let masterExpress = null;
  let masterKoa = null;
  let jwtHandler = null;
  let configureMicroServices = null;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Master = function () {
      this.start = jasmine.createSpy();

      events.EventEmitter.call(this);
    };

    Master.prototype = Object.create(events.EventEmitter.prototype);
    Master.prototype.constructor = Master;

    mockery.enable();
  });

  beforeEach(() => {
    master = new Master();
    master.__revert__ = qewd.__set__('q', master);

    configureMicroServices = jasmine.createSpy();
    configureMicroServices.__revert__ = qewd.__set__('configureMicroServices', configureMicroServices);

    qx = jasmine.createSpyObj(['addTo']);
    qx.build = 'qoper8-express-1.2.12';
    mockery.registerMock('ewd-qoper8-express', qx);

    qxKoa = jasmine.createSpyObj(['addTo']);
    qxKoa.build = 'qoper8-koa-1.3.24';
    mockery.registerMock('ewd-qoper8-koa', qxKoa);

    masterExpress = jasmine.createSpy();
    mockery.registerMock('./master-express', masterExpress);

    masterKoa = jasmine.createSpy();
    mockery.registerMock('./master-koa', masterKoa);

    jwtHandler = jasmine.createSpyObj(['foo', 'bar']);
    mockery.registerMock('./jwtHandler', jwtHandler);

    spyOn(master, 'on');
  });

  afterAll(() => {
    mockery.disable();
  });

  afterEach(() => {
    revert(master);
    revert(configureMicroServices);

    mockery.deregisterAll();
  });

  describe('master', () => {
    describe('config', () => {
      it('default', () => {
        const params = {};
        const routes = null;

        spyOn(process, 'cwd').and.returnValue('/path/to');

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config).toEqual({
          managementPassword: 'keepThisSecret',
          serverName: 'qewd',
          port: 8080,
          poolSize: 1,
          poolPrefork: false,
          idleLimit: 3600000,
          webServer: 'express',
          webServerRootPath: '/path/to/www/',
          no_sockets: false,
          webSockets: {
            module: 'socket.io'
          },
          ssl: false,
          cors: false,
          masterProcessPid: jasmine.any(Number),
          database: undefined,
          errorLogFile: false,
          mode: 'production',
          bodyParser: false,
          addMiddleware: false,
          initialSessionTimeout: 300,
          sessionDocumentName: 'CacheTempEWDSession',
          moduleMap: false,
          lockSession: false,
          resilientMode: false,
          customSocketModule: false,
          jwt: false,
          qxBuild: 'qoper8-express-1.2.12'
        });
      });

      it('custom managementPassword', () => {
        const params = {
          managementPassword: 'foo'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.managementPassword).toBe('foo');
      });

      it('custom serverName', () => {
        const params = {
          serverName: 'bar'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.serverName).toBe('bar');
      });

      it('custom port', () => {
        const params = {
          port: 3000
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.port).toBe(3000);
      });

      it('custom poolSize', () => {
        const params = {
          poolSize: 8
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.poolSize).toBe(8);
      });

      it('custom poolPrefork', () => {
        const params = {
          poolPrefork: true
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.poolPrefork).toBeTruthy();
      });

      it('custom idleLimit', () => {
        const params = {
          idleLimit: 120000
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.idleLimit).toBe(120000);
      });

      it('custom webServer', () => {
        const params = {
          webServer: 'koa'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterKoa.calls.argsFor(0)[0];
        expect(config.webServer).toBe('koa');
      });

      it('custom webServerRootPath', () => {
        const params = {
          webServerRootPath: '/path/to/'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.webServerRootPath).toBe('/path/to/');
      });

      it('custom no_sockets', () => {
        const params = {
          no_sockets: true
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.no_sockets).toBeTruthy();
      });

      it('custom webSockets', () => {
        const params = {
          webSockets: {}
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.webSockets).toEqual({});
      });

      it('custom ssl', () => {
        const params = {
          ssl: {
            keyFilePath: 'xxx.key',
            certFilePath: 'xxx.crt'
          }
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.ssl).toEqual({
          keyFilePath: 'xxx.key',
          certFilePath: 'xxx.crt'
        });
      });

      it('custom cors', () => {
        const params = {
          cors: true
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.cors).toBeTruthy();
      });

      it('custom database', () => {
        const db = dbMock.mock();
        const params = {
          database: db
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.database).toBe(db);
      });

      it('custom errorLogFile', () => {
        const params = {
          errorLogFile: '/path/to/error/log'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.errorLogFile).toBe('/path/to/error/log');
      });

      it('custom mode', () => {
        const params = {
          mode: 'staging'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.mode).toBe('staging');
      });

      it('custom bodyParser', () => {
        const fn = jasmine.createSpy();
        const params = {
          bodyParser: fn
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.bodyParser).toBe(fn);
      });

      it('custom addMiddleware', () => {
        const fn = jasmine.createSpy();
        const params = {
          addMiddleware: fn
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.addMiddleware).toBe(fn);
      });

      it('custom initialSessionTimeout', () => {
        const params = {
          initialSessionTimeout: 450
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.initialSessionTimeout).toBe(450);
      });

      it('custom sessionDocumentName', () => {
        const params = {
          sessionDocumentName: 'fooBar'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.sessionDocumentName).toBe('fooBar');
      });

      it('custom moduleMap', () => {
        const params = {};
        const routes = [
          {
            path: '/path/to/foo',
            module: 'foo'
          },
          {
            path: 'bar'
          }
        ];

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.moduleMap).toEqual({
          'path/to/foo': 'foo',
          bar: 'bar'
        });
      });

      it('custom lockSession', () => {
        const params = {
          lockSession: {
            timeout: 60
          }
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.lockSession).toEqual({
          timeout: 60
        });
      });

      describe('resilientMode', () => {
        it('custom resilientMode 1', () => {
          const params = {
            resilientMode: true
          };
          const routes = null;

          qewd.start(params, routes);

          const config = masterExpress.calls.argsFor(0)[0];
          expect(config.resilientMode).toEqual({
            documentName: 'ewdQueue',
            keepPeriod: 3600
          });
        });

        it('custom resilientMode 2', () => {
          const params = {
            resilientMode: {
              queueDocumentName: 'fooBaz',
              keepPeriod: 7200
            }
          };
          const routes = null;

          qewd.start(params, routes);

          const config = masterExpress.calls.argsFor(0)[0];
          expect(config.resilientMode).toEqual({
            documentName: 'fooBaz',
            keepPeriod: 7200
          });
        });
      });

      it('custom customSocketModule', () => {
        const params = {
          customSocketModule: 'foo/bar'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.customSocketModule).toBe('foo/bar');
      });

      it('custom jwt', () => {
        const params = {
          jwt: {
            foo: 'bar'
          }
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.jwt).toEqual({
          foo: 'bar',
          handlers: jwtHandler
        });
      });

      it('custom webServer', () => {
        const params = {
          webServer: 'quux'
        };
        const routes = null;

        qewd.start(params, routes);

        const config = masterExpress.calls.argsFor(0)[0];
        expect(config.webServer).toBe('express');
      });
    });

    it('should configure jwt', () => {
      const params = {
        jwt: {
          foo: 'bar'
        }
      };
      const routes = null;

      qewd.start(params, routes);

      expect(master.jwt).toEqual({
        foo: 'bar',
        handlers: jwtHandler
      });
    });

    it('should configure microservices', () => {
      const params = {
        u_services: {
          destinations: {
            login_service: {
              host: 'http://192.168.1.121:8080',  // *** change this to the IP address of your Micro-Service server
              application: 'login-micro-service'
            }
          },
          routes: [
            {
              path: '/api/login',
              method: 'POST',
              destination: 'login_service'
            }
          ]
        }
      };
      const routes = null;

      qewd.start(params, routes);

      expect(configureMicroServices).toHaveBeenCalledWithContext(master, params.u_services);
    });

    it('should configure express', () => {
      const params = {
        webServer: 'express'
      };
      const routes = [];

      qewd.start(params, routes);

      expect(qx.addTo).toHaveBeenCalledWith(master);
      expect(masterExpress).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qx);
    });

    it('should configure koa', () => {
      const params = {
        webServer: 'koa'
      };
      const routes = [];

      qewd.start(params, routes);

      expect(qxKoa.addTo).toHaveBeenCalledWith(master);
      expect(masterKoa).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qxKoa);
    });

    it('should start qoper8 master process', () => {
      const params = {};

      qewd.start(params);

      expect(master.start).toHaveBeenCalled();
    });

    describe('start', () => {
      it('should add event listener', () => {
        const params = {};

        qewd.start(params);

        expect(master.on).toHaveBeenCalledWith('start', jasmine.any(Function));
      });
    });

    describe('started', () => {
      it('should add event listener', () => {
        const params = {};

        qewd.start(params);

        expect(master.on).toHaveBeenCalledWith('start', jasmine.any(Function));
      });
    });
  });

  describe('intercept', () => {
  });
});
