import { get_bindings } from '../view.js';

export const selected_property = {
  type: 'prop',
  key: 'selected',
  /**
   *
   * @param {Galaxy.ViewNode} viewNode
   * @param {Galaxy.View.ReactiveData} scopeReactiveData
   * @param prop
   * @param {Function} expression
   */
  beforeActivate: function (viewNode, scopeReactiveData, prop, expression) {
    if (!scopeReactiveData) {
      return;
    }

    if (expression && viewNode.blueprint.tag === 'select') {
      throw new Error('select.selected property does not support binding expressions ' +
        'because it must be able to change its data.\n' +
        'It uses its bound value as its `model` and expressions can not be used as model.\n');
    }

    // Don't do anything if the node is an option tag
    if (viewNode.blueprint.tag === 'select') {
      const bindings = get_bindings(viewNode.blueprint.selected);
      const id = bindings.propertyKeys[0].split('.').pop();
      const nativeNode = viewNode.node;
      nativeNode.addEventListener('change', (event) => {
        console.log(viewNode.node, 'SELECTED', event);
      });
    }
  },
  update: function (viewNode, value) {
    const nativeNode = viewNode.node;

    viewNode.rendered.then(function () {
      if (nativeNode.value !== value) {
        if (viewNode.blueprint.tag === 'select') {
          nativeNode.value = value;
        } else if (value) {
          nativeNode.setAttribute('selected', true);
        } else {
          nativeNode.removeAttribute('selected');
        }
      }
    });
  }
};

