'use strict';

const mockery = require('mockery');
const rewire = require('rewire');
const isAsyncSupported = require('is-async-supported')();
const wsConfig = isAsyncSupported ? rewire('../../lib/master-koa') : jasmine.createSpy();
const rootSuite = isAsyncSupported ? describe : xdescribe;

rootSuite('unit/master-koa:', () => {
  let app;
  let koaRouter;
  let koaBodyParser;
  let koaServe;
  let q;
  let qx;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    mockery.enable();
  });

  afterAll(() => {
    mockery.disable();
  });

  beforeEach(() => {
    jasmine.clock().install();

    koaRouter = jasmine.createSpyObj(['addRoute', 'middleware']);
    koaRouter.__revert__ = wsConfig.__set__('koaRouter', koaRouter);

    app = jasmine.createSpyObj(['use']);
    app.__revert__ = wsConfig.__set__('app', app);

    koaBodyParser = jasmine.createSpy();
    koaBodyParser.__revert__ = wsConfig.__set__('koaBodyParser', koaBodyParser);

    koaServe = jasmine.createSpy();
    koaServe.__revert__ = wsConfig.__set__('koaServe', koaServe);

    qx = jasmine.createSpyObj(['router', 'handleMessage']);
    q = jasmine.createSpyObj(['foo', 'bar']);
  });

  afterEach(() => {
    jasmine.clock().uninstall();

    revert(koaRouter);
    revert(app);
    revert(koaBodyParser);
    revert(koaServe);

    mockery.deregisterAll();
  });

  it('should return app', () => {
    const config = {};
    const routes = null;

    const actual = wsConfig(config, routes, q, qx);

    expect(actual).toBe(app);
  });

  describe('/ajax', () => {
    describe('GET /ajax', () => {
      it('should add event handler', () => {
        const config = {};
        const routes = null;

        wsConfig(config, routes, q, qx);

        expect(koaRouter.addRoute).toHaveBeenCalledWith('GET /ajax*', jasmine.any(Function));
      });

      it('should process request', (done) => {
        const config = {};
        const routes = null;
        const handlers = [];
        const ctx = {
          state: {},
          params: {
            foo: 'bar'
          },
          request: {
            headers: {}
          }
        };
        const next = jasmine.createSpy().and.callFake(() => {
          return {
            then: cb => cb()
          };
        });

        koaRouter.addRoute.and.callFake((route, fn) => handlers.push(fn));
        qx.handleMessage.and.callFake((ctx, cb) => cb());

        wsConfig(config, routes, q, qx);

        const fn = handlers[0];
        fn(ctx, next).then(() => {
          expect(qx.handleMessage).toHaveBeenCalledWith({
            params: {
              foo: 'bar'
            },
            state: {
              params: {
                foo: 'bar'
              }
            },
            request: {
              headers: {
                qewd: 'ajax'
              }
            }
          }, jasmine.any(Function));
          expect(next).toHaveBeenCalled();

          done();
        });
      });
    });

    describe('POST /ajax', () => {
      it('should add event handler', () => {
        const config = {};
        const routes = null;

        wsConfig(config, routes, q, qx);

        expect(koaRouter.addRoute).toHaveBeenCalledWith('POST /ajax*', jasmine.any(Function));
      });

      it('should process request', (done) => {
        const config = {};
        const routes = null;
        const handlers = [];
        const ctx = {
          state: {},
          params: {
            baz: 'quux'
          },
          request: {
            headers: {}
          }
        };
        const next = jasmine.createSpy().and.callFake(() => {
          return {
            then: cb => cb()
          };
        });

        koaRouter.addRoute.and.callFake((route, fn) => handlers.push(fn));
        qx.handleMessage.and.callFake((ctx, cb) => cb());

        wsConfig(config, routes, q, qx);

        const fn = handlers[1];
        fn(ctx, next).then(() => {
          expect(qx.handleMessage).toHaveBeenCalledWith({
            params: {
              baz: 'quux'
            },
            state: {
              params: {
                baz: 'quux'
              }
            },
            request: {
              headers: {
                qewd: 'ajax'
              }
            }
          }, jasmine.any(Function));
          expect(next).toHaveBeenCalled();

          done();
        });
      });
    });
  });

  describe('responseTime', () => {
    beforeEach(() => {
      const nowUtc = new Date(Date.UTC(2017, 0, 1));
      jasmine.clock().mockDate(nowUtc);
    });

    it('should set X-ResponseTime header', (done) => {
      const config = {};
      const routes = null;
      const handlers = [];
      const ctx = jasmine.createSpyObj(['set']);
      const next = jasmine.createSpy().and.callFake(() => {
        return {
          then: cb => {
            jasmine.clock().tick(3000);
            cb();
          }
        };
      });
      app.use.and.callFake(fn => handlers.push(fn));

      wsConfig(config, routes, q, qx);

      const fn = handlers[1];
      fn(ctx, next).then(() => {
        expect(next).toHaveBeenCalled();
        expect(ctx.set).toHaveBeenCalledWith('X-ResponseTime', '3000ms');

        done();
      });
    });

    it('should set CORS headers', (done) => {
      const config = {
        cors: true
      };
      const routes = null;
      const handlers = [];
      const ctx = jasmine.createSpyObj(['set']);
      const next = jasmine.createSpy().and.callFake(() => {
        return {
          then: cb => cb()
        };
      });
      app.use.and.callFake(fn => handlers.push(fn));

      wsConfig(config, routes, q, qx);

      const fn = handlers[1];
      fn(ctx, next).then(() => {
        expect(next).toHaveBeenCalled();
        expect(ctx.set).toHaveBeenCalledTimes(5);
        expect(ctx.set.calls.argsFor(1)).toEqual(['Access-Control-Allow-Credentials', 'true']);
        expect(ctx.set.calls.argsFor(2)).toEqual(['Access-Control-Allow-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization']);
        expect(ctx.set.calls.argsFor(3)).toEqual(['Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS']);
        expect(ctx.set.calls.argsFor(4)).toEqual(['Access-Control-Allow-Origin', '*']);

        done();
      });

    });
  });

  it('should handle static requests', () => {
    const config = {
      webServerRootPath: '/var/www/domain.com'
    };
    const routes = null;

    const fn = jasmine.createSpy();
    koaServe.and.returnValue(fn);

    wsConfig(config, routes, q, qx);

    expect(koaServe).toHaveBeenCalledWith('/var/www/domain.com');
    expect(app.use).toHaveBeenCalledWith(fn);
  });

  it('should init middleware', () => {
    const config = {};
    const routes = null;

    const fn = jasmine.createSpy();
    koaRouter.middleware.and.returnValue(fn);

    wsConfig(config, routes, q, qx);

    expect(koaRouter.middleware).toHaveBeenCalled();
    expect(app.use).toHaveBeenCalledWith(fn);
  });

  describe('end of middleware chain', () => {
    let fn;

    beforeEach(() => {
      const config = {};
      const routes = null;
      const handlers = [];

      app.use.and.callFake(fn => handlers.push(fn));

      wsConfig(config, routes, q, qx);

      fn = handlers[handlers.length - 1];
    });

    it('should not set body', () => {
      const ctxs = [
        {
          state: {
            nextCallback: true
          }
        },
        {
          state: {
            nextCallback: false
          }
        }
      ];

      ctxs.forEach(ctx => {
        fn(ctx);
        expect(ctx.body).toBeUndefined();
      });
    });

    it('should set body', () => {
      const ctx = {
        state: {
          nextCallback: false,
          responseObj: {
            foo: 'bar'
          }
        }
      };

      fn(ctx);

      expect(ctx.body).toEqual({
        foo: 'bar'
      });
    });
  });

  describe('bodyParser', () => {
    it('should initialize default body parser module', () => {
      const config = {};
      const routes = null;

      const fn = jasmine.createSpy();
      koaBodyParser.and.returnValue(fn);

      wsConfig(config, routes, q, qx);

      expect(koaBodyParser).toHaveBeenCalled();
      expect(app.use).toHaveBeenCalledWith(fn);
    });

    it('should initialize custom body parser module', () => {
      const config = {
        bodyParser: {
          foo: 'bar'
        },
        addMiddleware: jasmine.createSpy()
      };
      const routes = null;

      wsConfig(config, routes, q, qx);

      expect(config.addMiddleware).toHaveBeenCalledWith(config.bodyParser, app, q, qx, config);
    });
  });

  describe('addMiddleware', () => {
    it('should initialize custom body parser module', () => {
      const config = {
        addMiddleware: jasmine.createSpy()
      };
      const routes = null;

      wsConfig(config, routes, q, qx);

      expect(config.addMiddleware).toHaveBeenCalledWith(koaBodyParser, app, q, qx, config);
    });
  });

  describe('cors', () => {
    it('should initialize cors', () => {
      const config = {
        cors: true
      };
      const routes = null;

      wsConfig(config, routes, q, qx);

      expect(qx.cors).toBeTruthy();
    });
  });

  describe('routes', () => {
    it('should define route', () => {
      const config = {};
      const routes = [
        {
          path: '/foo/bar'
        }
      ];

      wsConfig(config, routes, q, qx);

      const args = [jasmine.any(Function)];

      expect(koaRouter.addRoute).toHaveBeenCalledTimes(12);
      expect(koaRouter.addRoute.calls.argsFor(2)).toEqual(['GET /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(3)).toEqual(['GET /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(4)).toEqual(['POST /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(5)).toEqual(['POST /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(6)).toEqual(['DELETE /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(7)).toEqual(['DELETE /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(8)).toEqual(['PUT /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(9)).toEqual(['PUT /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(10)).toEqual(['PATCH /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(11)).toEqual(['PATCH /foo/bar/:type/*', args]);
    });

    it('should handle route request', (done) => {
      const config = {};
      const routes = [
        {
          path: '/foo/bar'
        }
      ];
      const handlers = [];
      const ctx = {
        state: {},
        params: {
          foo: 'bar'
        }
      };
      const next = jasmine.createSpy().and.callFake(() => {
        return {
          then: cb => cb()
        };
      });

      koaRouter.addRoute.and.callFake((pattern, fns) => handlers.push(fns[0]));
      qx.handleMessage.and.callFake((ctx, cb) => cb());

      wsConfig(config, routes, q, qx);

      const fn = handlers[2];
      fn(ctx, next).then(() => {
        expect(qx.handleMessage).toHaveBeenCalledWith({
          params: {
            foo: 'bar'
          },
          state: {
            params: {
              foo: 'bar'
            }
          }
        }, jasmine.any(Function));
        expect(next).toHaveBeenCalled();

        done();
      });


    });

    it('should add beforeRouter handler to route handlers chain', () => {
      const beforeRouter = jasmine.createSpy();
      const config = {};
      const routes = [
        {
          path: '/foo/bar',
          beforeRouter: [beforeRouter]
        }
      ];

      wsConfig(config, routes, q, qx);

      const args = [beforeRouter, jasmine.any(Function)];

      expect(koaRouter.addRoute).toHaveBeenCalledTimes(12);
      expect(koaRouter.addRoute.calls.argsFor(2)).toEqual(['GET /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(3)).toEqual(['GET /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(4)).toEqual(['POST /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(5)).toEqual(['POST /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(6)).toEqual(['DELETE /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(7)).toEqual(['DELETE /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(8)).toEqual(['PUT /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(9)).toEqual(['PUT /foo/bar/:type/*', args]);
      expect(koaRouter.addRoute.calls.argsFor(10)).toEqual(['PATCH /foo/bar/:type', args]);
      expect(koaRouter.addRoute.calls.argsFor(11)).toEqual(['PATCH /foo/bar/:type/*', args]);
    });

    describe('afterRouter', () => {
      it('should add afterRouter handler to route handlers chain', () => {
        const afterRouter = jasmine.createSpy();
        const config = {};
        const routes = [
          {
            path: '/foo/bar',
            afterRouter: [afterRouter]
          }
        ];

        wsConfig(config, routes, q, qx);

        const args = [jasmine.any(Function), afterRouter];

        expect(koaRouter.addRoute).toHaveBeenCalledTimes(12);
        expect(koaRouter.addRoute.calls.argsFor(2)).toEqual(['GET /foo/bar/:type', args]);
        expect(koaRouter.addRoute.calls.argsFor(3)).toEqual(['GET /foo/bar/:type/*', args]);
        expect(koaRouter.addRoute.calls.argsFor(4)).toEqual(['POST /foo/bar/:type', args]);
        expect(koaRouter.addRoute.calls.argsFor(5)).toEqual(['POST /foo/bar/:type/*', args]);
        expect(koaRouter.addRoute.calls.argsFor(6)).toEqual(['DELETE /foo/bar/:type', args]);
        expect(koaRouter.addRoute.calls.argsFor(7)).toEqual(['DELETE /foo/bar/:type/*', args]);
        expect(koaRouter.addRoute.calls.argsFor(8)).toEqual(['PUT /foo/bar/:type', args]);
        expect(koaRouter.addRoute.calls.argsFor(9)).toEqual(['PUT /foo/bar/:type/*', args]);
        expect(koaRouter.addRoute.calls.argsFor(10)).toEqual(['PATCH /foo/bar/:type', args]);
        expect(koaRouter.addRoute.calls.argsFor(11)).toEqual(['PATCH /foo/bar/:type/*', args]);
      });

      it('should handle route request', (done) => {
        const afterRouter = jasmine.createSpy();
        const config = {};
        const routes = [
          {
            path: '/foo/bar',
            afterRouter: [afterRouter]
          }
        ];
        const handlers = [];
        const ctx = {
          state: {},
          params: {
            foo: 'bar'
          }
        };
        const next = jasmine.createSpy().and.callFake(() => {
          return {
            then: cb => cb()
          };
        });

        koaRouter.addRoute.and.callFake((pattern, fns) => handlers.push(fns[0]));
        qx.handleMessage.and.callFake((ctx, cb) => cb());

        wsConfig(config, routes, q, qx);

        const fn = handlers[2];
        fn(ctx, next).then(() => {
          expect(qx.handleMessage).toHaveBeenCalledWith({
            params: {
              foo: 'bar'
            },
            state: {
              nextCallback: true,
              params: {
                foo: 'bar'
              }
            }
          }, jasmine.any(Function));
          expect(next).toHaveBeenCalled();

          done();
        });
      });
    });
  });
});

