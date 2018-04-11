/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['style.config'] = {
    type: 'none'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['style'] = {
    type: 'custom',
    name: 'style',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {string} attr
     * @param value
     */
    handler: function (viewNode, attr, value) {
      if (value instanceof Object) {
        Object.assign(viewNode.node.style, value);
      } else {
        viewNode.node.setAttribute('style', value);
      }
    }
  };
})(Galaxy.View);

