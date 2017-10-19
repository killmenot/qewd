'use strict';

const events = require('events');
const mockery = require('mockery');
const rewire = require('rewire');
const qewdWorker = rewire('../../lib/worker');
const documentStoreMock = rewire('./mocks/documentStore');
const sessionsMock = rewire('./mocks/sessions');
const dbMock = rewire('./mocks/db');

describe('unit/worker:', () => {
  let Worker = null;
  let worker = null;
  let build = null;
  let sessions = null;
  let resilientMode = null;
  let appHandler = null;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Worker = function () {
      this.userDefined = {
        config: {}
      };

      this.documentStore = documentStoreMock.mock();
      this.db = dbMock.mock();
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
    worker = new Worker();
    spyOn(worker, 'on').and.callThrough();

    build = {
      no: '1.2.3',
      date: '1 January 2017'
    };
    build.__revert__ = qewdWorker.__set__('build', build);

    sessions = sessionsMock.mock();
    sessions.__revert__ = qewdWorker.__set__('sessions', sessions);

    resilientMode = jasmine.createSpyObj(['garbageCollector']);
    resilientMode.__revert__ = qewdWorker.__set__('resilientMode', resilientMode);

    appHandler = jasmine.createSpy();
    mockery.registerMock('./appHandler', appHandler);
  });

  afterEach(() => {
    revert(build);
    revert(sessions);
    revert(resilientMode);

    mockery.deregisterAll();
  });

  describe('xpress', () => {
    it('build prop', () => {
      qewdWorker.call(worker);

      expect(worker.xpress.build).toEqual(
        jasmine.objectContaining({
          no: '1.2.3',
          date: '1 January 2017'
        })
      );
    });
  });

  describe('DocumentStoreStarted', () => {
    it('should add event listener', () => {
      qewdWorker.call(worker);

      expect(worker.on).toHaveBeenCalledWith('DocumentStoreStarted', jasmine.any(Function));
    });

    it('should init props', () => {
      const jwt = jasmine.createSpyObj(['foo']);
      worker.userDefined.config = {
        jwt: jwt
      };

      qewdWorker.call(worker);
      worker.emit('DocumentStoreStarted');

      expect(worker.sessions).toBe(sessions);
      expect(worker.jwt).toBe(jwt);
      expect(worker.handlers).toEqual({});
      expect(worker.beforeHandlers).toEqual({});
      expect(worker.afterHandlers).toEqual({});
      expect(worker.servicesAllowed).toEqual({});
    });

    it('should run #sessions.init', () => {
      worker.userDefined.config = {
        sessionDocumentName: 'foo'
      };

      qewdWorker.call(worker);
      worker.emit('DocumentStoreStarted');

      expect(sessions.init).toHaveBeenCalledWith(worker.documentStore, 'foo');
    });

    it('should run #sessions.garbageCollector', () => {
      qewdWorker.call(worker);
      worker.emit('DocumentStoreStarted');

      expect(sessions.garbageCollector).toHaveBeenCalledWith(worker, 60);
    });

    it('should run #resilientMode.garbageCollector', () => {
      worker.userDefined.config.resilientMode = {
        documentName: 'ewdQueue',
        keepPeriod: 3600
      };

      qewdWorker.call(worker);
      worker.emit('DocumentStoreStarted');

      expect(resilientMode.garbageCollector).toHaveBeenCalledWithContext(worker);
    });

    describe('db.use', () => {
      let documentNode = null;

      beforeEach(() => {
        documentNode = jasmine.createSpyObj(['quux']);
        worker.documentStore.DocumentNode.and.returnValue(documentNode);

        qewdWorker.call(worker);
        worker.emit('DocumentStoreStarted');
      });

      it('should work when subscripts is array', () => {
        const actual = worker.db.use('foo', ['bar', 'baz']);

        expect(worker.documentStore.DocumentNode).toHaveBeenCalledWith('foo', ['bar', 'baz']);
        expect(actual).toBe(documentNode);
      });

      it('should work when subscripts is args', () => {
        const actual = worker.db.use('foo', 'bar', 'baz');

        expect(worker.documentStore.DocumentNode).toHaveBeenCalledWith('foo', ['bar', 'baz']);
        expect(actual).toBe(documentNode);
      });
    });
  });

  describe('start', () => {
    it('should add event listener', () => {
      qewdWorker.call(worker);

      expect(worker.on).toHaveBeenCalledWith('start', jasmine.any(Function));
    });

    it('should set isFirst', () => {
      qewdWorker.call(worker);
      worker.emit('start', true);

      expect(worker.isFirst).toBeTruthy();
    });

    it('should load up dynamic app handler mechanism', () => {
      worker.userDefined.config = {
        database: {}
      };

      qewdWorker.call(worker);
      worker.emit('start', true);

      expect(appHandler).toHaveBeenCalledWithContext(worker);
    });

    it('should load up ewd-qoper8-cache', () => {
      const db = jasmine.createSpy();
      mockery.registerMock('ewd-qoper8-cache', db);

      worker.userDefined.config = {
        database: {
          type: 'cache',
          params: {
            foo: 'bar'
          }
        }
      };

      qewdWorker.call(worker);
      worker.emit('start', true);

      expect(db).toHaveBeenCalledWith(worker, {
        foo: 'bar'
      });
    });

    it('should load up ewd-qoper8-gtm', () => {
      const db = jasmine.createSpy();
      mockery.registerMock('ewd-qoper8-gtm', db);

      worker.userDefined.config = {
        database: {
          type: 'gtm',
          params: {
            foo: 'bar'
          }
        }
      };

      qewdWorker.call(worker);
      worker.emit('start', true);

      expect(db).toHaveBeenCalledWith(worker, {
        foo: 'bar'
      });
    });

    it('should load up ewd-qoper8-redis', () => {
      const db = jasmine.createSpy();
      mockery.registerMock('ewd-qoper8-redis', db);

      worker.userDefined.config = {
        database: {
          type: 'redis',
          params: {
            foo: 'bar'
          }
        }
      };

      qewdWorker.call(worker);
      worker.emit('start', true);

      expect(db).toHaveBeenCalledWith(worker, {
        foo: 'bar'
      });
    });
  });

  describe('setCustomErrorResponse', () => {
    it('should return false', () => {
      qewdWorker.call(worker);

      [
        {},
        {
          application: 'foo'
        }
      ].forEach((params) => {
        const actual = worker.setCustomErrorResponse(params);
        expect(actual).toBeFalsy();
      });
    });

    it('should set default application custom error', () => {
      const params = {
        application: 'foo',
        errorType: 'baz'
      };

      qewdWorker.call(worker);
      worker.setCustomErrorResponse(params);

      expect(worker.errorMessages.foo.baz).toEqual({
        text: 'Unspecified Error',
        statusCode: '400'
      });
    });

    it('should set custom application custom error', () => {
      const params = {
        application: 'foo',
        errorType: 'baz',
        text: 'error message',
        statusCode: '500'
      };

      worker.errorMessages = {
        foo: {}
      };

      qewdWorker.call(worker);
      worker.setCustomErrorResponse(params);

      expect(worker.errorMessages.foo.baz).toEqual({
        text: 'error message',
        statusCode: '500'
      });
    });
  });
});
