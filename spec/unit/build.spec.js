'use strict';

describe('unit/build:', () => {
  it('should return build information', () => {
    const build = require('../../lib/build');

    expect(build.no).toEqual(jasmine.any(String));
    expect(build.date).toEqual(jasmine.any(String));
  });
});
