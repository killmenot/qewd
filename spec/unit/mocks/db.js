'use strict';

module.exports = {
  mock: function () {
    var db = {
      lock: jasmine.createSpy()
    };

    return db;
  }
};
