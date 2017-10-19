'use strict';

module.exports = {
  mock: () => {
    const sessions = {
      init: jasmine.createSpy(),
      authenticate: jasmine.createSpy(),
      create: jasmine.createSpy(),
      garbageCollector: jasmine.createSpy()
    };

    return sessions;
  }
};
