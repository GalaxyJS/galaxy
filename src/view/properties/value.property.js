/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['value.config'] = {
    type: 'none'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'prop',
    name: 'value',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    setup: function valueUtil(viewNode, scopeReactiveData, prop, expression) {
      if (expression) {
        throw new Error('input.value property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.value);
      const id = bindings.propertyKeysPaths[0].split('.').pop();
      const nativeNode = viewNode.node;
      if (nativeNode.type === 'number') {
        nativeNode.addEventListener('input', function () {
          scopeReactiveData.data[id] = nativeNode.value ? Number(nativeNode.value) : null;
        });
      } else {
        nativeNode.addEventListener('keyup', function () {
          scopeReactiveData.data[id] = nativeNode.value;
        });
      }
    },
    value: function (viewNode, value, oldValue, attr) {
      viewNode.node[attr] = value === undefined ? '' : value;
    }
  };
})(Galaxy.View);

