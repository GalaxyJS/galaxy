/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'prop',
    name: 'checked',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    setup: function (viewNode, scopeReactiveData, prop, expression) {
      if (expression && viewNode.schema.tag === 'input') {
        throw new Error('input.checked property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.checked);
      const id = bindings.propertyKeysPaths[0].split('.').pop();
      const nativeNode = viewNode.node;
      nativeNode.addEventListener('change', function () {
        if (/\[\]$/.test(nativeNode.name)) {
          const data = scopeReactiveData.data[id];
          if (data instanceof Array) {
            if (data.indexOf(nativeNode.value) === -1) {
              data.push(nativeNode.value);
            } else {
              data.splice(data.indexOf(nativeNode.value), 1);
            }
          } else {
            scopeReactiveData.data[id] = [nativeNode.value];
          }
        } else {
          scopeReactiveData.data[id] = nativeNode.checked;
        }
      });
    },
    value: function (viewNode, value) {
      const nativeNode = viewNode.node;

      if (/\[\]$/.test(nativeNode.name)) {
        if (value instanceof Array) {
          nativeNode.checked = value.indexOf(nativeNode.value) !== -1;
        } else {
          nativeNode.checked = false;
        }
      } else {
        nativeNode.checked = value;
      }
    }
  };
})(Galaxy.View);

