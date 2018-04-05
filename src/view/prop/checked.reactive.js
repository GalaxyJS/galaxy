/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'prop',
    name: 'checked',
    /**
     *
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param {Galaxy.GalaxyView.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    util: function (viewNode, scopeReactiveData, prop, expression) {
      if (expression && viewNode.schema.tag === 'input') {
        throw new Error('input.checked property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.checked);
      const id = bindings.propertyKeysPaths[0].split('.').pop();
      viewNode.node.addEventListener('change', function () {
        scopeReactiveData.data[id] = viewNode.node.checked;
      });
    }
  };
})(Galaxy.GalaxyView);

