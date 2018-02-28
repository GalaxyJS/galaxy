/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['value.config'] = {
    type: 'none'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'prop',
    name: 'value',
    util: function (viewNode, prop, expression, dataObject) {
      if (expression) {
        throw new Error('input.value property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.value);
      const id = bindings.variableNamePaths.split('.').pop();
      if (bindings.modifiers === 'number') {
        viewNode.node.addEventListener('keyup', function () {
          dataObject[id] = viewNode.node.value ? Number(viewNode.node.value) : null;
        });
      } else {
        viewNode.node.addEventListener('keyup', function () {
          dataObject[id] = viewNode.node.value;
        });
      }
    }
  };
})(Galaxy.GalaxyView);

