/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['text'] = {
    type: 'prop',
    key: 'text',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param value
     */
    update: function (viewNode, value) {
      const nativeNode = viewNode.node;
      const textNode = nativeNode['<>text'];
      let textValue = typeof value === 'undefined' || value === null ? '' : value;

      if (textValue instanceof Function) {
        textValue = textValue.call(viewNode, viewNode.data);
      } else if (textValue instanceof Object) {
        textValue = JSON.stringify(textValue);
      }

      if (textNode) {
        textNode.textContent = textValue;
      } else {
        nativeNode['<>text'] = document.createTextNode(textValue);
        nativeNode.insertBefore(nativeNode['<>text'], nativeNode.firstChild);
      }
    }
  };
})(Galaxy);
