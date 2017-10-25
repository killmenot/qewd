'use strict';

module.exports = (mockery, boot, config) => {
  const noop = () => null;
  const moduleName = config.moduleName;
  const onMessage = config.onMessage || noop;
  const onSuccess = config.onSuccess || noop;
  const onError = config.onError || noop;

  describe('load module', () => {
    let appHandler;
    let worker;
    let messageObj;
    let send;
    let finished;

    beforeEach((done) => {
      boot((_appHandler, _worker, _send, _finished) => {
        appHandler = _appHandler;
        worker = _worker;
        messageObj = onMessage();
        send = _send;
        finished = _finished;

        done();
      });
    });

    it('should return error when unable to load handler module', () => {
      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Unable to load handler module for: ' + moduleName,
        reason: jasmine.any(Error)
      });

      onError();
    });

    it('should return custom error when unable to load handler module', () => {
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

    it('should be able to load app module', () => {
      const appModule = {};
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      onSuccess();
    });

    it('should be able to load app module via moduleMap', () => {
      worker.userDefined.config.moduleMap = {};
      worker.userDefined.config.moduleMap[moduleName] = 'bar';

      const appModule = {};
      mockery.registerMock('bar', appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      onSuccess();
    });

    it('should be able to set handlers for application', () => {
      const appModule = {
        handlers: {
          baz: jasmine.createSpy()
        }
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.handlers[moduleName]).toBe(appModule.handlers);
    });

    it('should be able to set beforeHandler for application', () => {
      const appModule = {
        beforeHandler: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.beforeHandlers[moduleName]).toBe(appModule.beforeHandler);
    });

    it('should be able to set beforeHandler for application when beforeMicroServiceHandler passed', () => {
      const appModule = {
        beforeMicroServiceHandler: jasmine.createSpy().and.returnValue(true)
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      const messageObj2 = {
        baz: 'foobar'
      };
      const session2 = {};
      const send2 = jasmine.createSpy();
      const finished2 = jasmine.createSpy();
      const actual = worker.beforeHandlers[moduleName](messageObj2, session2, send2, finished2);

      expect(appModule.beforeMicroServiceHandler).toHaveBeenCalledWithContext(worker, messageObj2, finished2);
      expect(actual).toBeTruthy();
    });

    it('should be able to set afterHandler for application', () => {
      const appModule = {
        afterHandler: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.afterHandlers[moduleName]).toBe(appModule.afterHandler);
    });

    it('should be able to set servicesAllowed for application', () => {
      const appModule = {
        servicesAllowed: true
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.servicesAllowed[moduleName]).toBe(appModule.servicesAllowed);
    });

    it('should be able to set restModule for application', () => {
      const appModule = {
        restModule: true
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(worker.restModule[moduleName]).toBe(appModule.restModule);
    });

    it('should be able to call init for application', () => {
      const appModule = {
        init: jasmine.createSpy()
      };
      mockery.registerMock(moduleName, appModule);

      appHandler.call(worker);
      worker.emit('message', messageObj, send, finished);

      expect(appModule.init).toHaveBeenCalledWithContext(worker, moduleName);
    });
  });
};
