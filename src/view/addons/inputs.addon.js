/* global Galaxy */

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'custom',
    name: 'inputs',
    handler: function (viewNode, attr, value, scopeData) {
      if (viewNode.virtual) {
        return;
      }

      if (typeof value !== 'object' || value === null) {
        throw new Error('Inputs must be an object');
      }

      var keys = Object.keys(value);
      var bind;
      var attributeName;
      var attributeValue;
      var type;
      var clone = G.GalaxyView.createClone(value);

      for (var i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = value[attributeName];
        bind = null;
        type = typeof(attributeValue);

        if (type === 'string') {
          bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
        } else {
          bind = null;
        }

        if (bind) {
          viewNode.root.makeBinding(clone, scopeData, attributeName, bind[1]);
        }
      }

      if (viewNode.hasOwnProperty('__inputs__') && clone !== viewNode.__inputs__) {
        Galaxy.resetObjectTo(viewNode.__inputs__, clone);
      } else if (!viewNode.hasOwnProperty('__inputs__')) {
        Object.defineProperty(viewNode, '__inputs__', {
          value: clone,
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
