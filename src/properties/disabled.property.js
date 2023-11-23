import { set_attr } from '../view.js';

/**
 *
 * @type {Galaxy.View.BlueprintProperty}
 */
export const disabled_property = {
  type: 'attr',
  key: 'disabled',
  update: function (viewNode, value, attr) {
    viewNode.rendered.then(() => {
      if (viewNode.blueprint.tag.toLowerCase() === 'form') {
        const children = viewNode.node.querySelectorAll('input, textarea, select, button');

        if (value) {
          Array.prototype.forEach.call(children, input => input.setAttribute('disabled', ''));
        } else {
          Array.prototype.forEach.call(children, input => input.removeAttribute('disabled'));
        }
      }
    });

    set_attr(viewNode, value ? '' : null, attr);
  }
};

