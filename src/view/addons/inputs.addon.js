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
    bind: function (viewNode, scopeData, value) {
      if (value !== null && typeof  value !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(viewNode.schema, null, '  '));
      }
    },
    onApply: function (cache, viewNode, value, oldValue, matches, context) {
      if (viewNode.virtual) return;

      var clone = GV.bindSubjectsToData(value, context, true);

      if (viewNode.hasOwnProperty('[addon/inputs]') && clone !== viewNode['[addon/inputs]'].clone) {
        Galaxy.resetObjectTo(viewNode['[addon/inputs]'], {
          clone: clone,
          original: value
        });
      } else if (!viewNode.hasOwnProperty('[addon/inputs]')) {
        Object.defineProperty(viewNode, '[addon/inputs]', {
          value: {
            clone: clone,
            original: value
          },
          enumerable: false
        });
      }

      viewNode.addDependedObject(clone);
    }
  };

  Galaxy.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element['[addon/inputs]'].clone;

        return scope.inputs;
      },
      finalize: function () {
        GV.link(scope.element['[addon/inputs]'].clone, scope.element['[addon/inputs]'].original);
      }
    };
  });
})(Galaxy.GalaxyView);
