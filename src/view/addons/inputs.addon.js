/* global Galaxy */

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'custom',
    name: 'inputs',
    handler: function (viewNode, attr, value, oldValue, scopeData) {
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

      if (viewNode.hasOwnProperty('[addon/inputs]') && clone !== viewNode['[addon/inputs]']) {
        Galaxy.resetObjectTo(viewNode['[addon/inputs]'], clone);
      } else if (!viewNode.hasOwnProperty('[addon/inputs]')) {
        Object.defineProperty(viewNode, '[addon/inputs]', {
          value: clone,
          enumerable: false
        });
      }
    }
  };

  G.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element['[addon/inputs]'];

        return scope.inputs;
      },
      finalize: function () {

      }
    };
  });
})(Galaxy);
