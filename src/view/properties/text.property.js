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
      let textValue = typeof value === 'undefined' || value === null ? '' : value;
      if (textValue instanceof Object) {
        textValue = JSON.stringify(textValue);
      }

      const nativeNode = viewNode.node;
      const textNode = nativeNode['<>text'];
      if (textNode) {
        textNode.textContent = textValue;
      } else {
        const tn = nativeNode['<>text'] = document.createTextNode(textValue);
        nativeNode.insertBefore(tn, nativeNode.firstChild);
      }
    }
  };
})(Galaxy);
