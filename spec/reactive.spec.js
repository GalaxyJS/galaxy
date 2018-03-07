/* global Galaxy */

describe('GalaxyJS Core', function () {
  it('Galaxy.GalaxyCore exist', function () {
    expect(Galaxy.GalaxyCore).toBeDefined();
  });

  it('Galaxy.GalaxyView instance', function () {
    expect(Galaxy.GalaxyView).toBeDefined();
  });

  it('GalaxyView.BindSubjectsToData instance', function () {
    const subjects = {
      property1: '<>p'
    };

    const scope = {
      p: 'value 1'
    };

    const bound = Galaxy.GalaxyView.bindSubjectsToData(subjects, scope, true);
  });
});

