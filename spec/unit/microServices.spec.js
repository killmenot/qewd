'use strict';

const events = require('events');
const rewire = require('rewire');
const microServices = rewire('../../lib/microServices');

describe('unit/microServices:', () => {
  let Worker;
  let worker;
  let QewdSocketClient;
  let SocketClient;
  let socketClient;
  let router;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Worker = function () {
      this.jwt = {
        secret: 'keep it private'
      };
    };

    SocketClient = function () {
      events.EventEmitter.call(this);
      this.start = jasmine.createSpy();
    };

    SocketClient.prototype = Object.create(events.EventEmitter.prototype);
    SocketClient.prototype.constructor = SocketClient;
  });

  beforeEach(() => {
    worker = new Worker();

    socketClient = new SocketClient();
    spyOn(socketClient, 'on').and.callThrough();

    QewdSocketClient = jasmine.createSpy().and.returnValue(socketClient);
    QewdSocketClient.__revert__ = microServices.__set__('QewdSocketClient', QewdSocketClient);

    router = jasmine.createSpy();
    router.routeParser = jasmine.createSpy();
    router.__revert__ = microServices.__set__('router', router);
  });

  afterEach(() => {
    revert(QewdSocketClient);
    revert(router);
  });

  describe('REST Microservice routes', () => {
    it('should setup micro-service connections', () => {
      const serviceConfig = {
        destinations: {
          login_service: {
            host: 'http://192.168.1.121:8080',
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
      };

      const route = jasmine.createSpyObj(['quux']);
      router.routeParser.and.returnValue(route);

      microServices.call(worker, serviceConfig);

      expect(QewdSocketClient).toHaveBeenCalledTimes(1);
      expect(socketClient.on).toHaveBeenCalledWith('ewd-registered', jasmine.any(Function));
      expect(socketClient.start).toHaveBeenCalledWith({
        url: 'http://192.168.1.121:8080',
        application: 'login-micro-service',
        log: true,
        jwt: {
          secret: 'keep it private'
        }
      });
      expect(router.routeParser).toHaveBeenCalledWith('/api/login');
      expect(worker.u_services).toEqual({
        clients: {
          'http://192.168.1.121:8080': socketClient
        },
        byApplication: {},
        byPath: {},
        restRoutes: [
          {
            pathTemplate: '/api/login',
            destination: 'login_service',
            method: 'POST',
            route: route
          }
        ],
        byDestination: {
          login_service: {
            host: 'http://192.168.1.121:8080',
            application: 'login-micro-service',
            client: socketClient
          }
        }
      });
    });

    describe('onResponse', () => {
      it('should setup micro-service connections', () => {
        const onResponse = jasmine.createSpy();

        const serviceConfig = {
          destinations: {
            login_service: {
              host: 'http://192.168.1.121:8080',
              application: 'login-micro-service'
            }
          },
          routes: [
            {
              path: '/api/login',
              method: 'POST',
              destination: 'login_service',
              onResponse: onResponse
            }
          ]
        };

        const route = jasmine.createSpyObj(['quux']);
        router.routeParser.and.returnValue(route);

        microServices.call(worker, serviceConfig);

        expect(worker.u_services).toEqual({
          clients: {
            'http://192.168.1.121:8080': socketClient
          },
          byApplication: {},
          byPath: {},
          restRoutes: [
            {
              pathTemplate: '/api/login',
              destination: 'login_service',
              method: 'POST',
              route: route,
              onResponse: onResponse
            }
          ],
          byDestination: {
            login_service: {
              host: 'http://192.168.1.121:8080',
              application: 'login-micro-service',
              client: socketClient
            }
          }
        });
      });
    });

    describe('onRequest', () => {
      it('should setup micro-service connections', () => {
        const onResponse = jasmine.createSpy('onResponse');
        const onRequest = jasmine.createSpy('onRequest');

        const serviceConfig = {
          destinations: {
            login_service: {
              host: 'http://192.168.1.121:8080',
              application: 'login-micro-service'
            }
          },
          routes: [
            {
              path: '/api/login',
              method: 'POST',
              destination: 'login_service',
              onResponse: onResponse,
              onRequest: onRequest
            }
          ]
        };

        const route = jasmine.createSpyObj(['quux']);
        router.routeParser.and.returnValue(route);

        microServices.call(worker, serviceConfig);

        expect(worker.u_services).toEqual({
          clients: {
            'http://192.168.1.121:8080': socketClient
          },
          byApplication: {},
          byPath: {},
          restRoutes: [
            {
              pathTemplate: '/api/login',
              method: 'POST',
              route: route,
              onRequest: onRequest
            }
          ],
          byDestination: {
            login_service: {
              host: 'http://192.168.1.121:8080',
              application: 'login-micro-service',
              client: socketClient
            }
          }
        });
      });
    });

    describe('router', () => {
      it('should setup router', () => {
        const onResponse = jasmine.createSpy('onResponse');
        const onRequest = jasmine.createSpy('onRequest');

        const serviceConfig = {
          destinations: {
            login_service: {
              host: 'http://192.168.1.121:8080',
              application: 'login-micro-service'
            }
          },
          routes: [
            {
              path: '/api/login',
              method: 'POST',
              destination: 'login_service',
              onResponse: onResponse,
              onRequest: onRequest
            }
          ]
        };

        const route = jasmine.createSpyObj(['quux']);
        router.routeParser.and.returnValue(route);

        microServices.call(worker, serviceConfig);

        expect(worker.router).toBe(router);
      });
    });

    it('should not setup router', () => {
      const onResponse = jasmine.createSpy('onResponse');
      const onRequest = jasmine.createSpy('onRequest');

      const serviceConfig = {
        destinations: {
          login_service: {
            host: 'http://192.168.1.121:8080',
            application: 'login-micro-service'
          }
        },
        routes: [
          {
            path: '/api/login',
            method: 'POST',
            destination: 'login_service',
            onResponse: onResponse,
            onRequest: onRequest
          }
        ]
      };

      const route = jasmine.createSpyObj(['quux']);
      router.routeParser.and.returnValue(route);

      worker.router = jasmine.createSpy();
      microServices.call(worker, serviceConfig);

      expect(worker.router).not.toBe(router);
    });
  });

  describe('QEWD WebSocket Application MicroService routes', () => {
    it('should setup micro-service connections using url and application', () => {
      const serviceConfig = [
        {
          application: 'jwt',
          types: {
            login: {
              url: 'http://192.168.1.97:3000',
              application: 'test-app'
            }
          }
        }
      ];

      microServices.call(worker, serviceConfig);

      expect(QewdSocketClient).toHaveBeenCalledTimes(1);
      expect(socketClient.on).toHaveBeenCalledWith('ewd-registered', jasmine.any(Function));
      expect(socketClient.start).toHaveBeenCalledWith({
        url: 'http://192.168.1.97:3000',
        application: 'test-app',
        log: true,
        jwt: {
          secret: 'keep it private'
        }
      });
      expect(worker.u_services).toEqual({
        clients: {
          'http://192.168.1.97:3000': socketClient
        },
        byApplication: {
          jwt: {
            login: {
              application: 'test-app',
              type: 'login',
              client: socketClient
            }
          }
        },
        byPath: {},
        restRoutes: [],
        byDestination: {}
      });
    });

    it('should setup micro-service connections using destination', () => {
      const serviceConfig = {
        destinations: {
          login_service: {
            host: 'http://192.168.1.121:8080',
            application: 'login-micro-service'
          }
        },
        routes: [
          {
            application: 'jwt',
            types: {
              login: {
                destination: 'login_service'
              }
            }
          }
        ]
      };

      microServices.call(worker, serviceConfig);

      expect(QewdSocketClient).toHaveBeenCalledTimes(1);
      expect(socketClient.on).toHaveBeenCalledWith('ewd-registered', jasmine.any(Function));
      expect(socketClient.start).toHaveBeenCalledWith({
        url: 'http://192.168.1.121:8080',
        application: 'login-micro-service',
        log: true,
        jwt: {
          secret: 'keep it private'
        }
      });
      expect(worker.u_services).toEqual({
        clients: {
          'http://192.168.1.121:8080': socketClient
        },
        byApplication: {
          jwt: {
            login: {
              application: 'login-micro-service',
              type: 'login',
              client: socketClient
            }
          }
        },
        byPath: {},
        restRoutes: [],
        byDestination: {
          login_service: {
            host: 'http://192.168.1.121:8080',
            application: 'login-micro-service',
            client: socketClient
          }
        }
      });
    });
  });

  describe('ewd-registered', () => {
    xit('should save registration token', () => {
      const serviceConfig = {
        destinations: {
          login_service: {
            host: 'http://192.168.1.121:8080',
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
      };

      const route = jasmine.createSpyObj(['quux']);
      router.routeParser.and.returnValue(route);

      microServices.call(worker, serviceConfig);
      socketClient.emit('ewd-registered');
    });
  });
});
