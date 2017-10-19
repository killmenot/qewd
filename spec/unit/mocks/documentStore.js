'use strict';

module.exports = {
  mock: () => {
    const documentStore = {
      DocumentNode: jasmine.createSpy()
    };

    return documentStore;
  }
};
