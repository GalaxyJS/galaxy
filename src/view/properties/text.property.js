/* global Galaxy */
(function (G) {
  G.View.NODE_SCHEMA_PROPERTY_MAP['text'] = {
    type: 'prop',
    name: 'text',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param value
     */
    value: function (viewNode, value) {
      const textNode = viewNode.node['<>text'];
      const textValue = typeof value === 'undefined' || value === null ? '' : value;

      if (textNode) {
        textNode.textContent = textValue;
      } else {
        viewNode.node['<>text'] = document.createTextNode(textValue);
        viewNode.node.insertBefore(viewNode.node['<>text'], viewNode.node.firstChild);
      }
    }
  };
})(Galaxy);
