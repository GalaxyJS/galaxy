/* global Galaxy */
(function (G) {
  /**
   *
   * @type {Galaxy.View.SchemaProperty}
   */
  G.View.NODE_SCHEMA_PROPERTY_MAP['disabled'] = {
    type: 'attr',
    name: 'disabled',
    value: function (viewNode, value, oldValue, attr) {
      viewNode.rendered.then(() => {
        if (viewNode.schema.tag.toLowerCase() === 'form') {
          const children = viewNode.node.querySelectorAll('input, textarea, select, button');

          if (value) {
            Array.prototype.forEach.call(children, input => input.setAttribute('disabled', ''));
          } else {
            Array.prototype.forEach.call(children, input => input.removeAttribute('disabled'));
          }
        }
      });

      G.View.setAttr(viewNode, value ? '' : null, oldValue, attr);
    }
  };
})(Galaxy);

