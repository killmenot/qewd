'use strict';

module.exports = {
  mock: () => {
    const db = {
      lock: jasmine.createSpy(),
      version: jasmine.createSpy(),
      set: jasmine.createSpy(),
      order: jasmine.createSpy(),
      kill: jasmine.createSpy()
    };

    return db;
  }
};
