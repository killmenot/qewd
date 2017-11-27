'use strict';

const mockery = require('mockery');
const rewire = require('rewire');
const wsConfig = rewire('../../lib/master-express');

describe('unit/master-express:', () => {
  let app;
  let express;
  let bodyParser;
  let q;
  let qx;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false
    });
  });

  afterAll(() => {
    mockery.disable();
  });

  beforeEach(() => {
    express = jasmine.createSpyObj(['static']);
    express.__revert__ = wsConfig.__set__('express', express);

    app = jasmine.createSpyObj(['use', 'post']);
    app.__revert__ = wsConfig.__set__('app', app);

    bodyParser = jasmine.createSpyObj(['json']);
    mockery.registerMock('body-parser', bodyParser);

    qx = jasmine.createSpyObj(['router', 'handleMessage']);
    q = jasmine.createSpyObj(['foo', 'bar']);
  });

  afterEach(() => {
    revert(express);
    revert(app);

    mockery.deregisterAll();
  });

  it('should return app', () => {
    const config = {};
    const routes = null;

    const actual = wsConfig(config, routes, q, qx);

    expect(actual).toBe(app);
  });

  describe('POST /ajax', () => {
    it('should add event handler', () => {
      const config = {};
      const routes = null;

      wsConfig(config, routes, q, qx);

      expect(app.post).toHaveBeenCalledWith('/ajax', jasmine.any(Function));
    });

    it('should process request', () => {
      const config = {};
      const routes = null;
      const handlers = [];
      const req = {
        headers: {}
      };
      const res = {};

      app.post.and.callFake((url, fn) => handlers.push(fn));

      wsConfig(config, routes, q, qx);

      const fn = handlers[0];
      fn(req, res);

      expect(req.headers.qewd).toBe('ajax');
      expect(qx.handleMessage).toHaveBeenCalledWith(req, res);
    });
  });

  it('should handle static requests', () => {
    const config = {
      webServerRootPath: '/var/www/domain.com'
    };
    const routes = null;

    const fn = jasmine.createSpy();
    express.static.and.returnValue(fn);

    wsConfig(config, routes, q, qx);

    expect(express.static).toHaveBeenCalledWith('/var/www/domain.com');
    expect(app.use).toHaveBeenCalledWith('/', fn);
  });

  describe('bodyParser', () => {
    it('should initialize default body parser module', () => {
      const config = {};
      const routes = null;

      const fn = jasmine.createSpy();
      bodyParser.json.and.returnValue(fn);

      wsConfig(config, routes, q, qx);

      expect(bodyParser.json).toHaveBeenCalled();
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

      expect(config.addMiddleware).toHaveBeenCalledWith(bodyParser, app, q, qx, config);
    });
  });

  describe('cors', () => {
    it('should initialize cors', () => {
      const config = {
        cors: true
      };
      const routes = null;
      const handlers = [];
      const req = {};
      const res = jasmine.createSpyObj(['header']);
      const next = jasmine.createSpy();

      app.use.and.callFake((url, fn) => handlers.push(fn));

      wsConfig(config, routes, q, qx);

      const fn = handlers[1]; // -> bodyParser.json, cors, express.static
      fn(req, res, next);

      expect(res.header).toHaveBeenCalledTimes(4);
      expect(res.header.calls.argsFor(0)).toEqual(['Access-Control-Allow-Credentials', 'true']);
      expect(res.header.calls.argsFor(1)).toEqual(['Access-Control-Allow-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization']);
      expect(res.header.calls.argsFor(2)).toEqual(['Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS']);
      expect(res.header.calls.argsFor(3)).toEqual(['Access-Control-Allow-Origin', '*']);
      expect(next).toHaveBeenCalled();
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

      qx.router.and.returnValue('/baz/quux');

      wsConfig(config, routes, q, qx);


      expect(qx.router).toHaveBeenCalledWith({
        nextCallback: false
      });
      expect(app.use).toHaveBeenCalledWithContext(app, '/foo/bar', '/baz/quux');
    });

    it('should add beforeRouter', () => {
      const config = {};
      const routes = [
        {
          path: '/foo/bar',
          beforeRouter: ['/before/router']
        }
      ];

      qx.router.and.returnValue('/baz/quux');

      wsConfig(config, routes, q, qx);

      expect(qx.router).toHaveBeenCalledWith({
        nextCallback: false
      });
      expect(app.use).toHaveBeenCalledWithContext(app, '/foo/bar', '/before/router', '/baz/quux');
    });

    it('should add afterRouter', () => {
      const config = {};
      const routes = [
        {
          path: '/foo/bar',
          afterRouter: ['/after/router']
        }
      ];

      qx.router.and.returnValue('/baz/quux');

      wsConfig(config, routes, q, qx);

      expect(qx.router).toHaveBeenCalledWith({
        nextCallback: true
      });
      expect(app.use).toHaveBeenCalledWithContext(app, '/foo/bar', '/baz/quux', '/after/router');
    });
  });
});

