/* global Galaxy, chai */

var expect = chai.expect;

describe('Galaxy System', function () {
  it('Galaxy should exist', function () {
    expect(Galaxy).to.be.a('object');
  });

  it('Should have GalaxySystem', function () {
    expect(Galaxy.GalaxySystem).to.be.a('function');
  });

  describe('GalaxySystem instance', function () {
    it('Make a GalaxySystem instance', function () {
      var galaxySystem = new Galaxy.GalaxySystem();
      expect(galaxySystem).to.be.a('object');
    });
  });
});