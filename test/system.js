/* global expect, Function, Galaxy */

describe('GalaxyJS System', function() {
  it('Galaxy.GalaxySystem exist', function() {

    expect(Galaxy.GalaxySystem).toBeDefined();
  });
  
  it('Galaxy.GalaxySystem instance', function() {
    var sample = new Galaxy.GalaxySystem();

    expect(sample).toBeDefined();
  });
});