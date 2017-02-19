/* global expect, Function, Galaxy */

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
    jasmine.Ajax.install();
    MockGalaxy = new Galaxy.GalaxySystem();
  });

  afterEach(function () {
    jasmine.Ajax.uninstall();
  });

  it('Galaxy app is NOT available before init', function () {
    expect(MockGalaxy.app).toBeNull();
  });

  it('Galaxy app is available after init', function () {
    MockGalaxy.init();

    expect(MockGalaxy.app).toBeDefined();
  });
});

describe('Galaxy boot', function () {
  var MockGalaxy = null;

  beforeEach(function () {
    jasmine.clock().install();
    jasmine.Ajax.install();
    MockGalaxy = new Galaxy.GalaxySystem();
  });

  afterEach(function () {
    jasmine.clock().uninstall();
    jasmine.Ajax.uninstall();
    MockGalaxy = null;
  });

  it('Calling Galaxy.init will fail if its called already', function () {
    expect(MockGalaxy.init.bind(MockGalaxy)).not.toThrow();
    expect(MockGalaxy.init.bind(MockGalaxy)).toThrowError('Galaxy is initialized already');
  });

  it('Calling Galaxy.start will fail when init has not been called', function () {
    expect(MockGalaxy.start.bind(MockGalaxy)).toThrowError();
  });

  it('Main module is loaded', function () {
    expect(MockGalaxy.app).toBeNull();

    var doneFn = jasmine.createSpy('success');
    MockGalaxy.boot({
      id: 'main',
      url: 'main.html'
    }, function (module) {
      console.log(module.scope.html[0].innerHTML);
      doneFn(module.scope.html[0].innerHTML);
    });

    expect(MockGalaxy.app).toBeDefined();

    expect(jasmine.Ajax.requests.mostRecent().url).toBe('main.html');
    expect(doneFn).not.toHaveBeenCalled();

    jasmine.Ajax.requests.mostRecent().respondWith({
      "status": 200,
      "responseText": '<h1>main module</h1>',
      "contentType": 'text/html'
    });

    setTimeout(function () {
      expect(doneFn).toHaveBeenCalledWith('main module');
    }, 100);
  });
});

