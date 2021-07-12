/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['text'] = {
    type: 'prop',
    name: 'text',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param value
     */
    value: function (viewNode, value) {
      const textNode = viewNode.node['<>text'];
      let textValue = typeof value === 'undefined' || value === null ? '' : value;

      if (textValue instanceof Object) {
        textValue = JSON.stringify(textValue);
      }

      if (textNode) {
        textNode.textContent = textValue;
      } else {
        viewNode.node['<>text'] = document.createTextNode(textValue);
        viewNode.node.insertBefore(viewNode.node['<>text'], viewNode.node.firstChild);
      }
    }
  };
})(Galaxy);
