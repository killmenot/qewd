'use strict';

const events = require('events');
const rewire = require('rewire');
const resilientMode = rewire('../../lib/resilientMode', {
  ignore: ['setInterval', 'setTimeout']
});
const dbMock = require('./mocks/db');
const documentStoreMock = require('./mocks/documentStore');

describe('unit/resilientMode:', () => {
  let Worker = null;
  let worker = null;
  let db = null;
  let documentStore = null;
  let token = null;
  let ix = null;
  let count = null;
  let handleMessage = null;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Worker = function (db, documentStore) {
      events.EventEmitter.call(this);

      this.db = db;
      this.documentStore = documentStore;
      this.userDefined = {
        config: {
          resilientMode: {
            documentName: 'ewdQueue',
            keepPeriod: 3600
          }
        }
      };
      this.resilientMode = {
        documentName: this.userDefined.config.resilientMode.documentName
      };
    };

    Worker.prototype = Object.create(events.EventEmitter.prototype);
    Worker.prototype.constructor = Worker;
  });

  beforeEach(() => {
    jasmine.clock().install();

    const nowTime = Date.UTC(2017, 0, 1); // 1483228800 * 1000, now
    jasmine.clock().mockDate(new Date(nowTime));

    db = dbMock.mock();
    documentStore = documentStoreMock.mock();
    worker = new Worker(db, documentStore);

    token = 'quux';
    ix = '1483228800000-1800216000000025';
    count = '42';
    handleMessage = jasmine.createSpy();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  // PUBLIC

  describe('storeResponse', () => {
    let requeueMessages = null;
    let saveResponse = null;
    let removePendingIndex = null;

    beforeEach(() => {
      requeueMessages = jasmine.createSpy();
      requeueMessages.__revert__ = resilientMode.__set__('requeueMessages', requeueMessages);

      saveResponse = jasmine.createSpy();
      saveResponse.__revert__ = resilientMode.__set__('saveResponse', saveResponse);

      removePendingIndex = jasmine.createSpy();
      removePendingIndex.__revert__ = resilientMode.__set__('removePendingIndex', removePendingIndex);
    });

    afterEach(() => {
      revert(requeueMessages);
      revert(saveResponse);
      revert(removePendingIndex);
    });

    it('should save the response to database', () => {
      const resultObj = {
        foo: 'bar'
      };

      resilientMode.storeResponse.call(worker, resultObj, token, ix, count, handleMessage);

      expect(requeueMessages).not.toHaveBeenCalled();
      expect(saveResponse).toHaveBeenCalledWithContext(worker, ix, count, '{"foo":"bar"}');
      expect(removePendingIndex).not.toHaveBeenCalled();
    });

    it('should re-queue any pending messages for this token', () => {
      const resultObj = {
        type: 'ewd-reregister'
      };

      resilientMode.storeResponse.call(worker, resultObj, token, ix, count, handleMessage);

      expect(requeueMessages).toHaveBeenCalledWithContext(worker, token, ix, handleMessage);
    });

    it('should remove the pending index record', () => {
      const resultObj = {
        finished: true
      };

      resilientMode.storeResponse.call(worker, resultObj, token, ix, count, handleMessage);

      expect(removePendingIndex).toHaveBeenCalledWithContext(worker, token, ix);
    });
  });

  describe('storeIncomingMessage', () => {
    it('should store incoming message', () => {
      const message = {
        token: 'foo'
      };

      spyOn(process, 'hrtime').and.returnValue([1800216, 25]);

      const actual = resilientMode.storeIncomingMessage.call(worker, message);

      expect(db.set).toHaveBeenCalledTimes(3);
      expect(db.set.calls.argsFor(0)).toEqual([
        {
          global: 'ewdQueue',
          subscripts: ['message', '1483228800000-1800216000000025', 'content'],
          data: '{"token":"foo"}'
        },
        jasmine.any(Function)
      ]);
      expect(db.set.calls.argsFor(1)).toEqual([
        {
          global: 'ewdQueue',
          subscripts: ['message', '1483228800000-1800216000000025', 'token'],
          data: 'foo'
        },
        jasmine.any(Function)
      ]);
      expect(db.set.calls.argsFor(2)).toEqual([
        {
          global: 'ewdQueue',
          subscripts: ['pending', 'foo', '1483228800000-1800216000000025'],
          data: ''
        },
        jasmine.any(Function)
      ]);
      expect(actual).toBe('1483228800000-1800216000000025');
    });
  });

  describe('storeWorkerStatusUpdate', () => {
    it('should store status update', () => {
      const queueStore = {};
      worker.documentStore.DocumentNode.and.returnValue(queueStore);

      const messageObj = {
        dbIndex: '42'
      };
      const status = 'started';

      resilientMode.storeWorkerStatusUpdate.call(worker, messageObj, status);

      expect(worker.documentStore.DocumentNode).toHaveBeenCalledWith('ewdQueue', ['message', '42', 'workerStatus']);
      expect(queueStore.value).toBe('started');
    });
  });

  describe('garbageCollector', () => {
    let cleardownQueueBackup = null;

    beforeEach(() => {
      cleardownQueueBackup = jasmine.createSpy();
      cleardownQueueBackup.__revert__ = resilientMode.__set__('cleardownQueueBackup', cleardownQueueBackup);
    });

    afterEach(() => {
      revert(cleardownQueueBackup);
    });

    it('should clear queue backup', function () {
      resilientMode.garbageCollector.call(worker);

      jasmine.clock().tick(6 * 60 * 1000);
      worker.emit('stop');

      expect(cleardownQueueBackup).toHaveBeenCalledWithContext(worker);
    });

    it('should clear queue backup via custom delay', function () {
      resilientMode.garbageCollector.call(worker, 60);

      jasmine.clock().tick(70 * 1000);
      worker.emit('stop');

      expect(cleardownQueueBackup).toHaveBeenCalledWithContext(worker);
    });
  });

  // PRIVATE

  describe('nextValue', () => {
    let nextValue = null;

    beforeEach(() => {
      nextValue = resilientMode.__get__('nextValue');
    });

    it('should call callback with results', () => {
      const glo = {
        global: 'ewdQueue',
        subscripts: ['pending', 'foobar', '']
      };
      const callback = jasmine.createSpy();

      const result = {
        data: '1'
      };
      db.order.and.callFake((glo, cb) => cb(null, result));

      nextValue.call(worker, glo, callback);

      expect(db.order).toHaveBeenCalledWith(glo, jasmine.any(Function));
      expect(callback).toHaveBeenCalledWith(result);
    });

    it('should not call callback when error', () => {
      const glo = {
        global: 'ewdQueue',
        subscripts: ['pending', 'foobar', '']
      };
      const callback = jasmine.createSpy();

      db.order.and.callFake((glo, cb) => cb('some error'));

      nextValue.call(worker, glo, callback);

      expect(db.order).toHaveBeenCalledWith(glo, jasmine.any(Function));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('requeueMessages', () => {
  });

  describe('saveResponse', () => {
    let saveResponse = null;

    beforeEach(() => {
      saveResponse = resilientMode.__get__('saveResponse');
    });

    it('should save response to database', () => {
      const data = '{"foo":"bar"}';

      saveResponse.call(worker, ix, count, data);

      expect(db.set).toHaveBeenCalledWith({
        global: 'ewdQueue',
        subscripts: ['message', '1483228800000-1800216000000025', 'response', '42'],
        data: '{"foo":"bar"}'
      }, jasmine.any(Function));
    });
  });

  describe('removePendingIndex', () => {
    let removePendingIndex = null;

    beforeEach(() => {
      removePendingIndex = resilientMode.__get__('removePendingIndex');
    });

    it('should remove pending index record', () => {
      removePendingIndex.call(worker, token, ix);

      jasmine.clock().tick(2 * 1000);

      expect(db.kill).toHaveBeenCalledWith({
        global: 'ewdQueue',
        subscripts: ['pending', 'quux', '1483228800000-1800216000000025']
      }, jasmine.any(Function));
    });
  });

  describe('saveResponse', () => {
  });

  describe('cleardownQueueBackup', () => {
    let cleardownQueueBackup = null;

    beforeEach(() => {
      cleardownQueueBackup = resilientMode.__get__('cleardownQueueBackup');
    });

    it('should clean queue backup', () => {
      // configure first messageObj
      const token1 = jasmine.createSpyObj(['$']);
      token1.$.and.returnValue({exists: true});
      const messageObj1 = jasmine.createSpyObj(['$', 'delete']);
      messageObj1.$.and.returnValue({value: 'foo'});

      // configure second messageObj
      const token2 = jasmine.createSpyObj(['$']);
      token2.$.and.returnValue({exists: false});
      const messageObj2 = jasmine.createSpyObj(['$', 'delete']);
      messageObj2.$.and.returnValue({value: 'bar'});

      // configure messages
      const messages = jasmine.createSpyObj(['forEachChild']);
      messages.forEachChild.and.callFake((cb) => {
        const result1 = cb('1483218000000-1800216000000025', messageObj1); // now - 2 hours
        expect(result1).toBeUndefined();

        const result2 = cb('1483221600000-1800216000000025', messageObj2); // now - 3 hours
        expect(result2).toBeUndefined();

        const result3 = cb('1483232400000-1800216000000025'); // now + 1 hour
        expect(result3).toBeTruthy();
      });

      // configure pending
      const pending = jasmine.createSpyObj(['$']);
      pending.$.and.returnValues(token1, token2);

      // configure queue
      const queue = jasmine.createSpyObj(['$']);
      queue.$.and.returnValues(messages, pending);
      documentStore.DocumentNode.and.returnValue(queue);

      cleardownQueueBackup.call(worker);

      // assert queue
      expect(documentStore.DocumentNode).toHaveBeenCalledWith('ewdQueue');
      expect(queue.$).toHaveBeenCalledTimes(2);
      expect(queue.$.calls.argsFor(0)).toEqual(['message']);
      expect(queue.$.calls.argsFor(1)).toEqual(['pending']);

      // assert messages
      expect(messages.forEachChild).toHaveBeenCalled();

      // assert pending
      expect(pending.$).toHaveBeenCalledTimes(2);
      expect(pending.$.calls.argsFor(0)).toEqual(['foo']);
      expect(pending.$.calls.argsFor(1)).toEqual(['bar']);

      // assert first messageObj
      expect(messageObj1.$).toHaveBeenCalledWith('token');
      expect(messageObj1.delete).not.toHaveBeenCalled();
      expect(token1.$).toHaveBeenCalledWith(1483218000000);

      // assert second messageObj
      expect(messageObj2.$).toHaveBeenCalledWith('token');
      expect(messageObj2.delete).toHaveBeenCalled();
      expect(token2.$).toHaveBeenCalledWith(1483221600000);

    });
  });
});
