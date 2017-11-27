'use strict';

const mockery = require('mockery');

describe('unit/qewd:', () => {
  beforeEach(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });
  });

  afterAll(() => {
    mockery.disable();
  });

  afterEach(() => {
    mockery.deregisterAll();
    mockery.resetCache();
  });

  it('should have master', () => {
    const master = jasmine.createSpyObj(['start', 'intercept']);
    mockery.registerMock('./master', master);

    const qewd = require('../../lib/qewd');
    qewd.master.start();
    expect(master.start).toHaveBeenCalled();

    qewd.master.intercept();
    expect(master.intercept).toHaveBeenCalled();
  });

  it('should have worker', () => {
    const worker = jasmine.createSpy();
    mockery.registerMock('./worker', worker);

    const qewd = require('../../lib/qewd');
    qewd.worker();

    expect(worker).toHaveBeenCalled();
  });
});
