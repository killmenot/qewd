'use strict';

module.exports = {
  mock: function () {
    var sessions = {
      authenticate: jasmine.createSpy(),
      create: jasmine.createSpy()
    };

    return sessions;
  }
};
