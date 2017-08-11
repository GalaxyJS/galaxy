/* global Galaxy */

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };
  // G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
  G.GalaxyView.REACTIVE_BEHAVIORS['inputs'] = {
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
          viewNode.root.makeBinding(clone, context, attributeName, bind[1]);
        }
      }

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

  G.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element['[addon/inputs]'].clone;

        return scope.inputs;
      },
      finalize: function () {
        G.GalaxyView.link(scope.element['[addon/inputs]'].clone, scope.element['[addon/inputs]'].original);
      }
    };
  });
})(Galaxy);
