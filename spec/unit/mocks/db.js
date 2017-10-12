'use strict';

module.exports = {
  mock: () => {
    const db = {
      lock: jasmine.createSpy()
    };

    return db;
  }
};
