'use strict';

module.exports = function (mockery, boot, config) {
  var noop = function () {};
  var moduleName = config.moduleName;
  var onMessage = config.onMessage || noop;
  var onSuccess = config.onSuccess || noop;
  var onError = config.onError || noop;

  describe('load module', function () {
    var appHandler;
    var worker;
    var messageObj;
    var send;
    var finished;
    var handleJWT;
    var session;

    beforeEach(function (done) {
      boot(function (_appHandler, _worker, _send, _finished, _handleJWT, _session) {
        appHandler = _appHandler;
        worker = _worker;
        messageObj = onMessage();
        send = _send;
        finished = _finished;
        handleJWT = _handleJWT;
        session = _session;

        done();
      });
    });

    it('should return error when unable to load handler module', function () {
      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Unable to load handler module for: ' + moduleName,
        reason: jasmine.any(Error)
      });

      onError();
    });

    it('should return custom error when unable to load handler module', function () {
      worker.errorMessages[moduleName] = {
        'moduleLoadError': 'Module load error - custom error'
      };

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Module load error - custom error',
        reason: jasmine.any(Error)
      });

      onError();
    });

    it('should be able to load app module', function () {
      var appModule = {};
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      onSuccess();
    });

    it('should be able to load app module via moduleMap', function () {
      worker.userDefined.config.moduleMap = {};
      worker.userDefined.config.moduleMap[moduleName] = 'bar';

      var appModule = {};
      mockery.registerMock('bar', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      onSuccess();
    });

    it('should be able to set handlers for application', function () {
      var appModule = {
        handlers: {
          baz: jasmine.createSpy()
        }
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.handlers[moduleName]).toBe(appModule.handlers);
    });

    it('should be able to set beforeHandler for application', function () {
      var appModule = {
        beforeHandler: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.beforeHandlers[moduleName]).toBe(appModule.beforeHandler);
    });

    it('should be able to set beforeHandler for application when beforeMicroServiceHandler passed', function () {
      var appModule = {
        beforeMicroServiceHandler: jasmine.createSpy().and.returnValue(true)
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      var messageObj2 = {
        baz: 'foobar'
      };
      var session2 = {};
      var send2 = jasmine.createSpy();
      var finished2 = jasmine.createSpy();
      var actual = worker.beforeHandlers[moduleName](messageObj2, session2, send2, finished2);

      expect(appModule.beforeMicroServiceHandler).toHaveBeenCalledWith(messageObj2, finished2);
      expect(actual).toBeTruthy();
    });

    it('should be able to set afterHandler for application', function () {
      var appModule = {
        afterHandler: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.afterHandlers[moduleName]).toBe(appModule.afterHandler);
    });

    it('should be able to set servicesAllowed for application', function () {
      var appModule = {
        servicesAllowed: true
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.servicesAllowed[moduleName]).toBe(appModule.servicesAllowed);
    });

    it('should be able to set restModule for application', function () {
      var appModule = {
        restModule: true
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.restModule[moduleName]).toBe(appModule.restModule);
    });

    it('should be able to call init for application', function () {
      var appModule = {
        init: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.init).toHaveBeenCalledWith(moduleName);
    });
  });
};
