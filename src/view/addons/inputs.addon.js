/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  GV.REACTIVE_BEHAVIORS['inputs'] = {
    regex: null,
    /**
     *
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param scopeData
     * @param value
     */
    bind: function (scopeData, value) {
      if (value !== null && typeof  value !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }
    },
    onApply: function (cache, value, oldValue, matches, context) {
      if (this.virtual) return;

      let clone = GV.bindSubjectsToData(value, context, true);

      if (this.hasOwnProperty('[addon/inputs]') && clone !== this['[addon/inputs]'].clone) {
        Galaxy.resetObjectTo(this['[addon/inputs]'], {
          clone: clone,
          original: value
        });
      } else if (!this.hasOwnProperty('[addon/inputs]')) {
        Object.defineProperty(this, '[addon/inputs]', {
          value: {
            clone: clone,
            original: value
          },
          enumerable: false
        });
      }

      this.addDependedObject(clone);
    }
  };

  Galaxy.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element['[addon/inputs]'].clone;

        return scope.inputs;
      },
      finalize: function () {
        // By linking the clone to original we make sure that changes on the local copy of the input data will be
        // reflected to the original one
        GV.link(scope.element['[addon/inputs]'].clone, scope.element['[addon/inputs]'].original);
      }
    };
  });
})(Galaxy.GalaxyView);
