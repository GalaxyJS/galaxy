export const text_3_property = {
  type: 'prop',
  key: 'nodeValue'
};
export const text_8_property = {
  type: 'prop',
  key: 'nodeValue'
};
export const text_property = {
  type: 'prop',
  key: 'text',
  /**
   *
   * @param {Galaxy.ViewNode} viewNode
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
      textNode.nodeValue = textValue;
    } else {
      const tn = nativeNode['<>text'] = document.createTextNode(textValue);
      nativeNode.insertBefore(tn, nativeNode.firstChild);
    }
  }
};
