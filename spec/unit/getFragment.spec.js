'use strict';

const rewire = require('rewire');
const getFragment = rewire('../../lib/getFragment');

describe('unit/getFragment:', () => {
  let messageObj = null;
  let application = null;
  let finished = null;
  let Worker = null;
  let worker = null;
  let fsMock = null;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(() => {
    Worker = function () {
      this.userDefined = {
        config: {
          webServerRootPath: '/var/www',
        }
      };
      this.servicesAllowed = {
        foo: {
          bar: true,
          baz: false
        }
      };
    };
  });

  beforeEach(() => {
    worker = new Worker();

    messageObj = {
      service: 'bar',
      params: {
        file: '/path/to/file.js'
      }
    };
    application = 'foo';
    finished = jasmine.createSpy();

    fsMock = jasmine.createSpyObj(['exists', 'readFile']);
    fsMock.__revert__ = getFragment.__set__('fs', fsMock);

    spyOn(require, 'resolve');
    require.__revert__ = getFragment.__set__('require', require);
  });

  afterEach(() => {
    revert(fsMock);
    revert(require);
  });

  it('should return service not permitted for application error', () => {
    messageObj.service = 'baz';

    getFragment.call(worker, messageObj, application, finished);

    expect(finished).toHaveBeenCalledWith({
      error: 'baz service is not permitted for the foo application'
    });
  });

  describe('file does not exist error', () => {
    beforeEach(function () {
      delete messageObj.service;

      require.resolve.and.returnValue('/services/bar.js');
      fsMock.exists.and.callFake(function (path, cb) {
        cb(false);
      });
    });

    it('should return error', () => {
      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js'
      });
    });

    it('should return error with service prop', () => {
      messageObj.service = 'bar';

      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js',
        service: 'bar'
      });
    });

    it('should return error with service prop', () => {
      messageObj.params.isServiceFragment = true;

      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js',
        isServiceFragment: true
      });
    });
  });

  it('should return unable to read file error', () => {
    require.resolve.and.returnValue('/services/bar.js');
    fsMock.exists.and.callFake(function (path, cb) {
      cb(true);
    });
    fsMock.readFile.and.callFake(function (path, options, cb) {
      cb(new Error('some error'));
    });

    getFragment.call(worker, messageObj, application, finished);

    expect(finished).toHaveBeenCalledWith({
      error: 'Unable to read file /services/fragments/path/to/file.js'
    });
  });

  it('should return content', () => {
    require.resolve.and.returnValue('/services/bar.js');
    fsMock.exists.and.callFake(function (path, cb) {
      cb(true);
    });
    fsMock.readFile.and.callFake(function (path, options, cb) {
      cb(null, 'some content');
    });

    getFragment.call(worker, messageObj, application, finished);

    expect(finished).toHaveBeenCalledWith({
      fragmentName: '/path/to/file.js',
      content: 'some content'
    });
  });
});
