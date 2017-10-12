'use strict';

module.exports = {
  mock: () => {
    const sessions = {
      authenticate: jasmine.createSpy(),
      create: jasmine.createSpy()
    };

    return sessions;
  }
};
