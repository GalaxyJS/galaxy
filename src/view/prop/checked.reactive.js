/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'prop',
    name: 'checked',
    util: function (viewNode, prop, expression, dataObject) {
      if (expression && viewNode.schema.tag === 'input') {
        throw new Error('input.checked property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.checked);
      const id = bindings.variableNamePaths.split('.').pop();
      viewNode.node.addEventListener('change', function () {
        dataObject[id] = viewNode.node.checked;
      });
    }
  };
})(Galaxy.GalaxyView);

