/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['selected'] = {
    type: 'prop',
    name: 'selected',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    setup: function (viewNode, scopeReactiveData, prop, expression) {
      if (expression && viewNode.schema.tag === 'select') {
        throw new Error('select.selected property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      // Don't do anything if the node is an option tag
      if (viewNode.schema.tag === 'select') {
        const bindings = GV.getBindings(viewNode.schema.selected);
        const id = bindings.propertyKeysPaths[0].split('.').pop();
        const nativeNode = viewNode.node;

        nativeNode.addEventListener('change', function () {
          scopeReactiveData.data[id] = nativeNode.options[nativeNode.selectedIndex].value;
        });

        nativeNode.addEventListener('post$forEnter', function () {
          if (scopeReactiveData.data[id] && !nativeNode.value) {
            nativeNode.value = scopeReactiveData.data[id];
          }
        });

        nativeNode.stream.filter('dom').filter('childList').subscribe(function() {

        });
      }
    },
    value: function (viewNode, value) {
      const nativeNode = viewNode.node;

      viewNode.rendered.then(function () {
        if (nativeNode.value !== value) {
          if (viewNode.schema.tag === 'select') {
            nativeNode.value = value;
          } else if (value) {
            nativeNode.setAttribute('selected');
          } else {
            nativeNode.removeAttribute('selected');
          }
        }
      });
    }
  };
})(Galaxy.View);

