'use strict';

const mockery = require('mockery');
const rewire = require('rewire');
const sockets = rewire('../../lib/sockets');
const handleResponseSpec = require('./shared/handleResponseSpec');
const dbMock = require('./mocks/db');

describe('unit/sockets:', () => {
  let resilientMode;
  let handleJWT;
  let Master;
  let master;
  let io;

  const getCustomSocketConnections = () => sockets.__get__('customSocketConnections');
  const setCustomSocketConnections = (x) => sockets.__set__('customSocketConnections', x);
  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Master = function () {
      this.workerResponseHandlers = {};
      this.handleMessage = jasmine.createSpy();
    };

    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false
    });
  });

  afterAll(() => {
    mockery.disable();
  });

  beforeEach(() => {
    jasmine.clock().install();

    master = new Master();
    io = jasmine.createSpyObj(['on', 'emit', 'clients', 'to']);

    resilientMode = jasmine.createSpyObj(['storeIncomingMessage', 'storeResponse']);
    resilientMode.__revert__ = sockets.__set__('resilientMode', resilientMode);

    handleJWT = jasmine.createSpyObj(['masterRequest']);
    handleJWT.__revert__ = sockets.__set__('handleJWT', handleJWT);
  });

  afterEach(() => {
    jasmine.clock().uninstall();

    revert(resilientMode);
    revert(handleJWT);

    mockery.deregisterAll();
  });

  describe('connection', () => {
    it('should add event handler', () => {
      sockets(master, io);
      expect(io.on).toHaveBeenCalledWith('connection', jasmine.any(Function));
    });

    it('should init workerResponseHandlers', () => {
      delete master.workerResponseHandlers;

      sockets(master, io);
      const connectionHandler = io.on.calls.argsFor(0)[1];

      const socket = jasmine.createSpyObj(['on', 'emit']);
      connectionHandler(socket);

      expect(master.workerResponseHandlers).toEqual({});
    });

    describe('ewdjs', () => {
      let socket;
      let connectionHandler;
      let ewdjsHandler;

      const boot = cb => cb(master, socket, ewdjsHandler);

      beforeEach(() => {
        const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
        jasmine.clock().mockDate(new Date(nowTime));

        socket = jasmine.createSpyObj(['on', 'emit']);
        socket.id = 'quux';
        socket.request = {
          connection: {
            remoteAddress: '192.168.1.13'
          }
        };

        sockets(master, io);
        connectionHandler = io.on.calls.argsFor(0)[1];

        connectionHandler(socket);
        ewdjsHandler = socket.on.calls.argsFor(0)[1];
      });

      it('should add event listener', () => {
        expect(socket.on).toHaveBeenCalledWith('ewdjs', jasmine.any(Function));
      });

      it('received message is not an object', () => {
        ewdjsHandler();

        expect(master.handleMessage).not.toHaveBeenCalled();
      });

      it('no type defined for message', () => {
        const data = {};

        ewdjsHandler(data);

        expect(master.handleMessage).not.toHaveBeenCalled();
      });

      describe('ewd-register', () => {
        it('should handle message', () => {
          const data = {
            type: 'ewd-register'
          };

          ewdjsHandler(data);

          expect(master.handleMessage).toHaveBeenCalledWith({
            type: 'ewd-register',
            socketId: 'quux',
            ipAddress: '192.168.1.13'
          }, jasmine.any(Function));
        });

        it('should record application used by this new socket', () => {
          master.sockets = {};

          const data = {
            type: 'ewd-register',
            jwt: true,
            application: 'baz',
            token: 'foobar'
          };

          ewdjsHandler(data);

          expect(master.sockets).toEqual({
            quux: {
              application: 'baz',
              jwt: true
            }
          });
        });

        it('should handle message by calling jwt handler master request', () => {
          const data = {
            type: 'ewd-register',
            jwt: true,
            application: 'baz',
            token: 'foobar'
          };

          ewdjsHandler(data);

          expect(handleJWT.masterRequest).toHaveBeenCalledWithContext(master, data, socket, jasmine.any(Function));
          expect(master.handleMessage).not.toHaveBeenCalled();
        });
      });

      describe('ewd-reregister', () => {
        it('should handle message', () => {
          const data = {
            type: 'ewd-reregister'
          };

          ewdjsHandler(data);

          expect(master.handleMessage).toHaveBeenCalledWith({
            type: 'ewd-reregister',
            socketId: 'quux',
            ipAddress: '192.168.1.13'
          }, jasmine.any(Function));
        });
      });

      describe('browser-based websocket application using JWTs', () => {
        it('should handle message by calling jwt handler master request', () => {
          master.sockets = {
            quux: {
              application: 'baz',
              jwt: true
            }
          };

          const data = {
            type: 'barbaz',
            application: 'baz',
            token: 'foobar'
          };

          ewdjsHandler(data);

          expect(handleJWT.masterRequest).toHaveBeenCalledWithContext(master, data, socket, jasmine.any(Function));
          expect(master.handleMessage).not.toHaveBeenCalled();
        });

        handleResponseSpec(mockery, boot, {
          onBeforeEach: () => {
            master.sockets = {
              [socket.id]: {
                application: 'baz',
                jwt: true
              }
            };
          },
          onConfigure: (resultObj) => {
            handleJWT.masterRequest.and.callFake((data, socket, handleResponse) => {
              jasmine.clock().tick(5 * 1000); // 5 seconds
              handleResponse(resultObj);
            });
          },
          onData: () => {
            return {
              type: 'quuuuuux',
              application: 'baz',
              token: 'foobar'
            };
          }
        });
      });

      describe('micro service server connections over web sockets', () => {
        it('should handle message by calling qoper8 handleMessage', () => {
          const data = {
            type: 'foo'
          };

          ewdjsHandler(data);

          expect(master.handleMessage).toHaveBeenCalledWith({
            type: 'foo'
          }, jasmine.any(Function));
        });

        handleResponseSpec(mockery, boot, {
          onConfigure: (resultObj) => {
            master.handleMessage.and.callFake((data, handleResponse) => {
              jasmine.clock().tick(5 * 1000); // 5 seconds
              handleResponse(resultObj);
            });
          },
          onData: () => {
            return {
              type: 'quuuuuux'
            };
          }
        });
      });

      describe('resilient mode', () => {
        beforeEach(() => {
          master.db = dbMock.mock();
          master.resilientMode = {
            documentName: 'ewdQueue'
          };
        });

        it('should do not record progress for ewd-register', () => {
          const data = {
            type: 'ewd-register'
          };

          const resultObj = {
            type: 'ewd-register',
            message: {
              foo: 'bar'
            }
          };
          master.handleMessage.and.callFake((data, handleResponse) => {
            jasmine.clock().tick(5 * 1000); // 5 seconds
            handleResponse(resultObj);
          });

          ewdjsHandler(data);

          expect(resilientMode.storeIncomingMessage).not.toHaveBeenCalled();
          expect(resilientMode.storeResponse).not.toHaveBeenCalled();
        });

        it('should record progress', () => {
          const data = {
            type: 'baz',
            token: 'tokenValue'
          };

          const resultObj = {
            type: 'baz',
            message: {
              foo: 'bar'
            }
          };
          master.handleMessage.and.callFake((data, handleResponse) => {
            jasmine.clock().tick(5 * 1000); // 5 seconds
            handleResponse(resultObj);
          });

          resilientMode.storeIncomingMessage.and.returnValues('ix');

          ewdjsHandler(data);

          expect(resilientMode.storeIncomingMessage).toHaveBeenCalledWithContext(master, {
            type: 'baz',
            token: 'tokenValue',
            dbIndex: 'ix'
          });
        });

        it('should store response', () => {
          const data = {
            type: 'baz',
            token: 'tokenValue'
          };

          const resultObj = {
            type: 'baz',
            message: {
              foo: 'bar'
            }
          };
          master.handleMessage.and.callFake((data, handleResponse) => {
            jasmine.clock().tick(5 * 1000); // 5 seconds
            handleResponse(resultObj);
          });

          resilientMode.storeIncomingMessage.and.returnValues('ix');

          ewdjsHandler(data);

          expect(resilientMode.storeResponse).toHaveBeenCalledWithContext(master, {
            type: 'baz',
            responseTime: '5000ms',
            message: {
              foo: 'bar'
            }
          }, 'tokenValue', 'ix', 1, jasmine.any(Function));
        });
      });
    });

    describe('disconnect', () => {
      let socket;
      let connectionHandler;

      beforeEach(() => {
        socket = jasmine.createSpyObj(['on', 'emit']);
        socket.id = 'quux';

        sockets(master, io);
        connectionHandler = io.on.calls.argsFor(0)[1];
      });

      it('should add event listener', () => {
        connectionHandler(socket);
        expect(socket.on).toHaveBeenCalledWith('disconnect', jasmine.any(Function));
      });

      it('should delete socket from custom socket connections', () => {
        connectionHandler(socket);

        setCustomSocketConnections({
          quux: 'connected'
        });

        const disconnectHandler = socket.on.calls.argsFor(1)[1];
        disconnectHandler();

        const customSocketConnections = getCustomSocketConnections();
        expect(customSocketConnections).toEqual({});
      });

      it('should delete browser-based websocket metadata', () => {
        connectionHandler(socket);

        master.sockets = {
          quux: {
            application: 'foo',
            jwt: true
          }
        };

        const disconnectHandler = socket.on.calls.argsFor(1)[1];
        disconnectHandler();

        expect(master.sockets).toEqual({});
      });
    });

    describe('custom socket module handlers', () => {
      it('should load custom module handlers', () => {
        const customModule = 'customModule';
        const spy = jasmine.createSpy();
        mockery.registerMock(customModule, spy);

        sockets(master, io, customModule);
        const connectionHandler = io.on.calls.argsFor(0)[1];
        const socket = jasmine.createSpyObj(['on', 'emit']);
        socket.id = 'quux';
        connectionHandler(socket);

        const customSocketConnections = getCustomSocketConnections();
        expect(customSocketConnections).toEqual({
          quux: 'connected'
        });
        expect(spy).toHaveBeenCalledWith(io, socket, master);
      });
    });
  });

  describe('jwt.handlers', () => {
    it('should be set', () => {
      master.jwt = {
        secret: 'keep it secret'
      };

      sockets(master, io);

      expect(master.jwt.handlers).toBe(handleJWT);
    });
  });

  describe('io', () => {
    it('should store reference to io', () => {
      sockets(master, io);
      expect(master.io).toBe(io);
    });

    describe('#toAll', () => {
      it('should be defined', () => {
        sockets(master, io);
        expect(io.toAll).toEqual(jasmine.any(Function));
      });

      it('should emit ewdjs with message', () => {
        const message = {
          type: 'foo'
        };

        sockets(master, io);
        io.toAll(message);

        expect(io.emit).toHaveBeenCalledWith('ewdjs', message);
      });
    });

    describe('#toApplication', () => {
      it('should be defined', () => {
        sockets(master, io);
        expect(io.toApplication).toEqual(jasmine.any(Function));
      });

      it('should emit ewdjs with message to application', () => {
        const message = {
          type: 'quux'
        };
        const application = 'bar';

        const appSocket = jasmine.createSpyObj(['emit']);
        io.to.and.returnValue(appSocket);

        master.sockets = {
          quux: {
            application: 'bar'
          },
          baz: {
            application: 'foo'
          }
        };

        sockets(master, io);
        io.toApplication(message, application);

        expect(io.to).toHaveBeenCalledWith('quux');
        expect(appSocket.emit).toHaveBeenCalledWith('ewdjs', message);
      });
    });
  });
});
