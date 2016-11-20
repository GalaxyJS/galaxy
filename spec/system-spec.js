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

  beforeEach(function () {
    jasmine.clock().install();
    jasmine.Ajax.install();
    this.MockGalaxy = new Galaxy.GalaxySystem();
  });

  afterEach(function () {
    jasmine.clock().uninstall();
    jasmine.Ajax.uninstall();
    this.MockGalaxy = null;
  });

  it('Calling Galaxy.init will fail if its called already', function () {    
    expect(this.MockGalaxy.init.bind(this.MockGalaxy)).not.toThrow();    
    expect(this.MockGalaxy.init.bind(this.MockGalaxy)).toThrowError('Galaxy is initialized already');
  });

  it('Calling Galaxy.start will fail when init has not been called', function () {
    expect(this.MockGalaxy.start.bind(this.MockGalaxy)).toThrowError();
  });

  it('Main module is loaded', function () {
    expect(this.MockGalaxy.app).toBeNull();

    var doneFn = jasmine.createSpy('success');
    this.MockGalaxy.boot({
      id: 'main',
      url: 'main.html'
    }, function (module) {
      doneFn(module.scope.html[0].innerHTML);
    });

    expect(this.MockGalaxy.app).toBeDefined();

    expect(jasmine.Ajax.requests.mostRecent().url).toBe('main.html');
    expect(doneFn).not.toHaveBeenCalled();

    jasmine.Ajax.requests.mostRecent().respondWith({
      "status": 200,
      "responseText": '<h1>main module</h1>',
      "contentType": 'text/html'
    });

    jasmine.clock().tick(101);
    expect(doneFn).toHaveBeenCalledWith('main module');
  });
});

