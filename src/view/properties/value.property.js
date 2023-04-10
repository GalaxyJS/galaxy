/* global Galaxy */
(function (G) {
  const IGNORE_TYPES = [
    'radio',
    'checkbox',
    'button',
    'reset',
    'submit'
  ];

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['value.config'] = {
    type: 'none'
  };

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['value'] = {
    type: 'prop',
    key: 'value',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    beforeActivate: function valueUtil(viewNode, scopeReactiveData, prop, expression) {
      const nativeNode = viewNode.node;
      if (!scopeReactiveData || IGNORE_TYPES.indexOf(nativeNode.type) !== -1) {
        return;
      }

      if (expression) {
        throw new Error('input.value property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = G.View.get_bindings(viewNode.blueprint.value);
      const id = bindings.propertyKeys[0].split('.').pop();
      if (nativeNode.tagName === 'SELECT') {
        const observer = new MutationObserver((data) => {
          viewNode.rendered.then(() => {
            // Set the value after the children are rendered
            nativeNode.value = scopeReactiveData.data[id];
          });
        });
        observer.observe(nativeNode, { childList: true });
        viewNode.finalize.push(() => {
          observer.disconnect();
        });
        nativeNode.addEventListener('change', createHandler(scopeReactiveData, id));
      } else if (nativeNode.type === 'number' || nativeNode.type === 'range') {
        nativeNode.addEventListener('input', createNumberHandler(nativeNode, scopeReactiveData, id));
      } else {
        nativeNode.addEventListener('input', createHandler(scopeReactiveData, id));
      }
    },
    update: function (viewNode, value) {
      // input field parse the value which has been passed to it into a string
      // that's why we need to parse undefined and null into an empty string
      if (value !== viewNode.node.value || !viewNode.node.value) {
        viewNode.node.value = value === undefined || value === null ? '' : value;
      }
    }
  };

  function createNumberHandler(_node, _rd, _id) {
    return function () {
      _rd.data[_id] = _node.value ? Number(_node.value) : null;
    };
  }

  function createHandler(_rd, _id) {
    return function (event) {
      _rd.data[_id] = event.target.value;
    };
  }
})(Galaxy);

