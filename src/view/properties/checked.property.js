/* global Galaxy */
(function (G) {
  G.View.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
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

      const bindings = G.View.getBindings(viewNode.schema.checked);
      const id = bindings.propertyKeysPaths[0].split('.').pop();
      const nativeNode = viewNode.node;
      nativeNode.addEventListener('change', function () {
        if (/\[\]$/.test(nativeNode.name) && nativeNode.type !== 'radio') {
          const data = scopeReactiveData.data[id];
          // if the node does not have value attribute, then we take its default value into the account
          // The default value for checkbox is 'on' but we translate that to true
          const value = nativeNode.hasAttribute('value') ? nativeNode.value : true;
          if (data instanceof Array) {
            if (data.indexOf(value) === -1) {
              data.push(value);
            } else {
              data.splice(data.indexOf(value), 1);
            }
          } else {
            scopeReactiveData.data[id] = [value];
          }
        }
        // if node has a value, then its value will be assigned according to its checked state
        else if (nativeNode.hasAttribute('value')) {
          scopeReactiveData.data[id] = nativeNode.checked ? nativeNode.value : null;
        }
        // if node has no value, then checked state would be its value
        else {
          scopeReactiveData.data[id] = nativeNode.checked;
        }
      });
    },
    value: function (viewNode, value) {
      const nativeNode = viewNode.node;
      viewNode.rendered.then(function () {
        if (/\[\]$/.test(nativeNode.name)) {
          if (nativeNode.type === 'radio') {
            console.error('Inputs with type `radio` can not provide array as a value.');
            return console.warn('Read about radio input at: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio');
          }

          const nodeValue = nativeNode.hasAttribute('value') ? nativeNode.value : true;
          if (value instanceof Array) {
            nativeNode.checked = value.indexOf(nodeValue) !== -1;
          } else {
            nativeNode.checked = value === nodeValue;
          }
        } else if (nativeNode.hasAttribute('value')) {
          nativeNode.checked = value === nativeNode.value;
        } else {
          nativeNode.checked = value;
        }
      });
    }
  };
})(Galaxy);

