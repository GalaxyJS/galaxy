/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'reactive',
    name: 'value'
  };

  GV.REACTIVE_BEHAVIORS['value'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (viewNode, nodeScopeData, matches) {
      var parts = matches[1].split('.');
      var setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
      viewNode.node.addEventListener('keyup', function () {
        if (nodeScopeData.hasOwnProperty(parts[0])) {
          setter.call(null, nodeScopeData, viewNode.node.value);
        } else if (nodeScopeData.hasOwnProperty('__parent__')) {
          setter.call(null, nodeScopeData.__parent__, viewNode.node.value);
        }
      });
    },
    onApply: function (cache, viewNode, value) {
      if (document.activeElement === viewNode.node && viewNode.node.value === value) {
        return;
      }

      viewNode.node.value = value || '';
    }
  };
})(Galaxy.GalaxyView);

