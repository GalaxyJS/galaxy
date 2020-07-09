/* global Galaxy */

(function (Galaxy) {
  const PROPERTY_NAME = 'disabled';
  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP[PROPERTY_NAME] = {
    type: 'attr',
    name: PROPERTY_NAME,
    value: function (viewNode, value, oldValue, attr) {
      viewNode.rendered.then(function () {
        if (viewNode.schema.tag.toLowerCase() === 'form') {
          const children = viewNode.node.querySelectorAll('input, textarea, select, button');

          if (value) {
            Array.prototype.forEach.call(children, function (input) {
              input.setAttribute('disabled', '');
            });
          } else {
            Array.prototype.forEach.call(children, function (input) {
              input.removeAttribute('disabled');
            });
          }
        }
      });

      Galaxy.View.setAttr(viewNode, value ? '' : null, oldValue, attr);
    }
  };
})(Galaxy);

