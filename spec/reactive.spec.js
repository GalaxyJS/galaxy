/* global Galaxy */

describe('GalaxyJS Core', function () {
  it('Galaxy.Core exist', function () {
    expect(Galaxy.GalaxyCore).toBeDefined();
  });

  it('Galaxy.View exist', function () {
    expect(Galaxy.View).toBeDefined();
  });

  it('Galaxy.View.ReactiveProperty exist', function () {
    expect(Galaxy.View.ReactiveProperty).toBeDefined();
  });

  describe('View.BindSubjectsToData instance', function () {
    let subjects = {
      property1: '<>p'
    };

    let scope = {
      p: 'Init Value'
    };

    let bound = Galaxy.View.bindSubjectsToData(subjects, scope, true);

    beforeEach(function () {
      subjects = {
        property1: '<>value',
        property2: '<>objValue'
      };

      scope = {
        value: 'Init Value',
        objValue: {
          name: 'Some Name'
        }
      };

      bound = Galaxy.View.bindSubjectsToData(subjects, scope, true);
    });

    it('Result is an object', function () {
      expect(bound).toBeDefined();
    });

    describe('After binding is done', function () {
      it('subjects should be intact', function () {
        expect(subjects).toEqual({
          property1: '<>value',
          property2: '<>objValue'
        });
      });

      it('bound.property should be equal to scope.value', function () {
        expect(bound.property1).toEqual(scope.value);
      });

      it('scope.value = \'New Value\', bound.property should be equal to \'New Value\'', function () {
        scope.value = 'New Value';
        expect(bound.property1).toEqual('New Value');
      });

      it('scope.value = \'New Value\', bound.property should be equal to scope.value', function () {
        scope.value = 'New Value';
        expect(bound.property1).toEqual(scope.value);
      });

      describe('Bindings are top to bottom and binding is on the object level and not the property level', function () {
        it('bound.property1 = \'New Value\', bound.property should NOT be equal to scope.value' +
          'and scope.value should be still equal to \'Init Value\'', function () {
          bound.property1 = 'New Value';
          expect(scope.value).toEqual('Init Value');
        });

        it('bound.property2.name = \'New Name\', scope.objValue.name should equal to \'New Value\'', function () {
          bound.property2.name = 'New Name';
          expect(scope.objValue.name).toEqual('New Name');
        });

        it('bound.property2.name = \'New Name\', scope.objValue.name should equal to bound.property2.name', function () {
          bound.property2.name = 'New Name';
          expect(scope.objValue.name).toEqual(bound.property2.name);
        });
      });
    });
  });
});

