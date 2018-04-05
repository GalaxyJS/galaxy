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
     * @param matches
     * @param scope
     */
    prepareData: function (matches, scope) {
      if (matches !== null && typeof  matches !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }

      return {
        subjects: matches,
        scope: scope
      };
    },
    /**
     *
     * @this {Galaxy.GalaxyView.ViewNode}
     * @param data
     * @return {boolean}
     */
    install: function (data) {
      if (this.virtual) {
        return;
      }

      const reactive = GV.bindSubjectsToData(this, data.subjects, data.scope, true);
      data.reactive = reactive;

      this.inputs = data.reactive;

      return false;
    },
    apply: function (cache, value, oldValue, context) { }
  };

  Galaxy.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      /**
       *
       * @return {*}
       */
      create: function () {
        scope.inputs = scope.element.cache.inputs.reactive;
        return scope.inputs;
      },
      finalize: function () { }
    };
  });
})(Galaxy.GalaxyView);
