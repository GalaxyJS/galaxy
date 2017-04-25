/* global Galaxy, fetchMock, Promise */

describe('GalaxyJS System', function () {
  it('Galaxy.GalaxySystem exist', function () {

    expect(Galaxy.GalaxySystem).toBeDefined();
  });

  it('Galaxy.GalaxySystem instance', function () {
    var sample = new Galaxy.GalaxySystem();

    expect(sample).toBeDefined();
  });
});

describe('Galaxy life cycle', function () {
  var MockGalaxy;
  beforeEach(function () {
    MockGalaxy = new Galaxy.GalaxySystem();
  });

  afterEach(function () {
  });

  it('Galaxy app is NOT available before init', function () {
    expect(MockGalaxy.app).toBeNull();
  });

  it('Galaxy app is available after init', function () {
    MockGalaxy.init();

    expect(MockGalaxy.app).toBeDefined();
  });
});

describe('Galaxy boot:', function () {
  var MockGalaxy = null;

  beforeEach(function () {
    MockGalaxy = new Galaxy.GalaxySystem();
  });

  afterEach(function () {
    MockGalaxy = null;
  });

  it('Calling Galaxy.init will fail if its called already', function () {
    expect(MockGalaxy.init.bind(MockGalaxy)).not.toThrow();
    expect(MockGalaxy.init.bind(MockGalaxy)).toThrowError('Galaxy is initialized already');
  });

  it('Calling Galaxy.start will fail when init has not been called', function () {
    expect(MockGalaxy.start.bind(MockGalaxy)).toThrowError();
  });

  it('Main module is loaded', function (done) {
    fetchMock.setImplementations({ Promise: Promise });
    fetchMock.mock('main.html?', {
      'status': 200,
      'body': '<h1>main module</h1>',
      'headers': {
        'content-type': 'text/html'
      }
    });

    expect(MockGalaxy.app).toBeNull();

    var doneFn = jasmine.createSpy('success');
    MockGalaxy.boot({
      id: 'main',
      url: 'main.html'
    }, function (module) {
      expect(module.scope.html[ 0 ].innerHTML).toBe('main module');
      doneFn(module.scope.html[ 0 ].innerHTML);
    });

    expect(MockGalaxy.app).toBeDefined();

    setTimeout(function () {
      expect(doneFn).toHaveBeenCalledWith('main module');
      done();
    }, 100);
  });
});

