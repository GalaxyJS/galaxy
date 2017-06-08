/* global Galaxy */

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'custom',
    name: 'inputs',
    handler: function (viewNode, attr, value) {
      if (typeof value !== 'object' || value === null) {
        throw new Error('Inputs must be an object');
      }

      if (viewNode.hasOwnProperty('__inputs__') && value !== viewNode.__inputs__) {
        Galaxy.resetObjectTo(viewNode.__inputs__, value);
      } else if (!viewNode.hasOwnProperty('__inputs__')) {
        Object.defineProperty(viewNode, '__inputs__', {
          value: value,
          enumerable: false
        });
      }
    }
  };

  G.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element.__inputs__;

        return scope.inputs;
      },
      finalize: function () {

      }
    };
  });
})(Galaxy);
