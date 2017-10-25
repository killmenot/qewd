'use strict';

module.exports = (mockery, boot, config = {}) => {
  const noop = () => null;
  const onBeforeEach = config.onBeforeEach || noop;
  const onConfigure = config.onConfigure || noop;
  const onData = config.onData || noop;

  describe('handle response', () => {
    let master;
    let socket;
    let ewdjsHandler;

    beforeEach((done) => {
      boot((_master, _socket, _ewdjsHandler) => {
        master = _master;
        socket = _socket;
        ewdjsHandler = _ewdjsHandler;

        onBeforeEach();

        done();
      });
    });

    it('should ignore messages directed to specific sockets', () => {
      const data = onData();
      const resultObj = {
        socketId: 'bazbar'
      };

      onConfigure(resultObj);

      ewdjsHandler(data);

      expect(socket.emit).not.toHaveBeenCalledWith('ewdjs', resultObj);
    });

    it('should send message to client', () => {
      const data = onData();
      const resultObj = {
        message: {
          foo: 'bar'
        }
      };

      onConfigure(resultObj);

      ewdjsHandler(data);

      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        responseTime: '5000ms',
        message: {
          foo: 'bar'
        }
      });
    });

    it('should not call worker response handler when error', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          error: 'some error'
        }
      };

      onConfigure(resultObj);

      const handler = jasmine.createSpy();
      master.workerResponseHandlers = {
        bar2: {
          foo2: handler
        }
      };

      ewdjsHandler(data);

      expect(handler).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        responseTime: '5000ms',
        type: 'foo2',
        message: {
          error: 'some error'
        }
      });
    });

    it('should call worker response handler and send message to client', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      onConfigure(resultObj);

      const resp = {
        ewd_application: 'bar2',
        quux3: 'baz3'
      };
      const handler = jasmine.createSpy().and.returnValue(resp);
      master.workerResponseHandlers = {
        bar2: {
          foo2: handler
        }
      };

      ewdjsHandler(data);

      expect(handler).toHaveBeenCalledWithContext(master, {
        ewd_application: 'bar2',
        quux2: 'baz2'
      }, jasmine.any(Function));
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        responseTime: '5000ms',
        type: 'foo2',
        message: {
          quux3: 'baz3'
        }
      });
    });

    it('should allow worker response handler to send the response to the client itself', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      onConfigure(resultObj);

      const handler = jasmine.createSpy().and.returnValue(true);
      master.workerResponseHandlers = {
        bar2: {
          foo2: handler
        }
      };

      ewdjsHandler(data);

      expect(handler).toHaveBeenCalledWithContext(master, {
        ewd_application: 'bar2',
        quux2: 'baz2'
      }, jasmine.any(Function));
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('should be able to handle no response from worker response handler', () => {
      const data = onData();
      const resultObj = {
        type: 'restRequest',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      onConfigure(resultObj);

      const handler = jasmine.createSpy().and.returnValue(null);
      master.workerResponseHandlers = {
        bar2: {
          restRequest: handler
        }
      };

      ewdjsHandler(data);

      expect(handler).toHaveBeenCalledWithContext(master, {
        ewd_application: 'bar2',
        quux2: 'baz2'
      }, jasmine.any(Function));
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        type: 'restRequest',
        responseTime: '5000ms',
        message: null
      });
    });

    it('should delete message path when type is restRequest', () => {
      const data = onData();
      const resultObj = {
        type: 'restRequest',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      onConfigure(resultObj);

      const resp = {
        quux3: 'baz3',
        path: '/api/login'
      };
      const handler = jasmine.createSpy().and.returnValue(resp);
      master.workerResponseHandlers = {
        bar2: {
          restRequest: handler
        }
      };

      ewdjsHandler(data);

      expect(handler).toHaveBeenCalledWithContext(master, {
        ewd_application: 'bar2',
        quux2: 'baz2'
      }, jasmine.any(Function));
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        responseTime: '5000ms',
        type: 'restRequest',
        message: {
          quux3: 'baz3'
        }
      });
    });

    it('should handle message when unable to load worker response intercept handler module for application', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      onConfigure(resultObj);


      ewdjsHandler(data);

      expect(master.workerResponseHandlers).toEqual({
        bar2: {}
      });
      expect(socket.emit).toHaveBeenCalledWith('ewdjs', {
        responseTime: '5000ms',
        type: 'foo2',
        message: {
          quux2: 'baz2'
        }
      });
    });

    it('should be able to intercept handler module loaded for application when no workerResponseHandlers defined', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      mockery.registerMock('bar2', {});
      onConfigure(resultObj);

      ewdjsHandler(data);

      expect(master.workerResponseHandlers).toEqual({
        bar2: {}
      });
    });

    it('should be able to intercept handler module loaded for application', () => {
      const data = onData();
      const resultObj = {
        type: 'foo2',
        message: {
          ewd_application: 'bar2',
          quux2: 'baz2'
        }
      };

      const workerResponseHandlers = jasmine.createSpyObj(['foo3']);
      mockery.registerMock('bar2', {
        workerResponseHandlers: workerResponseHandlers
      });
      onConfigure(resultObj);

      ewdjsHandler(data);

      expect(master.workerResponseHandlers).toEqual({
        bar2: workerResponseHandlers
      });
    });
  });
};
