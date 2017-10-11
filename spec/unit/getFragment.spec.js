'use strict';

var rewire = require('rewire');
var getFragment = rewire('../../lib/getFragment');

describe('unit/getFragment:', function () {
  var messageObj;
  var application;
  var finished;
  var Worker;
  var worker;
  var fsMock;

  var revert = function (obj) {
    obj.__revert__();
    delete obj.__revert__;
  };

  beforeAll(function () {
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

  beforeEach(function () {
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

  afterEach(function () {
    revert(fsMock);
    revert(require);
  });

  it('should return service not permitted for application error', function () {
    messageObj.service = 'baz';

    getFragment.call(worker, messageObj, application, finished);

    expect(finished).toHaveBeenCalledWith({
      error: 'baz service is not permitted for the foo application'
    });
  });

  describe('file does not exist error', function () {
    beforeEach(function () {
      delete messageObj.service;

      require.resolve.and.returnValue('/services/bar.js');
      fsMock.exists.and.callFake(function (path, cb) {
        cb(false);
      });
    });

    it('should return error', function () {
      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js'
      });
    });

    it('should return error with service prop', function () {
      messageObj.service = 'bar';

      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js',
        service: 'bar'
      });
    });

    it('should return error with service prop', function () {
      messageObj.params.isServiceFragment = true;

      getFragment.call(worker, messageObj, application, finished);

      expect(finished).toHaveBeenCalledWith({
        error: 'Fragment file /path/to/file.js does not exist',
        file: '/path/to/file.js',
        isServiceFragment: true
      });
    });
  });

  it('should return unable to read file error', function () {
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

  it('should return content', function () {
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
