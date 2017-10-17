'use strict';

module.exports = {
  mock: () => {
    const db = {
      lock: jasmine.createSpy(),
      version: jasmine.createSpy()
    };

    return db;
  }
};
