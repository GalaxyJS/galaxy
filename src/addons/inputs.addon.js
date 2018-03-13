/* global Galaxy */
'use strict';

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  GV.REACTIVE_BEHAVIORS['inputs'] = {
    regex: null,
    /**
     *
     * @this {Galaxy.GalaxyView.ViewNode}
     * @param context
     * @param value
     */
    prepareData: function (matches, scope) {
      if (matches !== null && typeof  matches !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }

      const reactive = GV.bindSubjectsToData(matches, scope, true);
      debugger;

      return {
        reactive: reactive,
        subjects: matches,
        scope: scope
      };
    },
    install: function (data) {
      if (this.virtual) {
        return;
      }

      if (this.cache.inputs && this.cache.inputs.reactive !== data.reactive) {
        Galaxy.resetObjectTo(this.cache.inputs, data);
      } else if (this.cache.inputs === undefined) {
        this.cache.inputs = data;
      }

      this.inputs = data.reactive;
      this.addDependedObject(data.reactive);

      return false;
    },
    apply: function (cache, value, oldValue, context) {

    }
  };

  Galaxy.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element.cache.inputs.reactive;

        return scope.inputs;
      },
      finalize: function () {
        // By linking the live to original we make sure that changes on the local copy of the input data will be
        // reflected to the original one
        // GV.link(scope.element.addons.inputs.live, scope.element.addons.inputs.original);
      }
    };
  });
})(Galaxy.GalaxyView);
