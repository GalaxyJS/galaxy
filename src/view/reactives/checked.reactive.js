/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'reactive',
    name: 'checked'
  };

  GV.REACTIVE_BEHAVIORS['checked'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (viewNode, nodeScopeData, matches) {
      var parts = matches[1].split('.');
      var setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
      viewNode.node.addEventListener('change', function () {
        setter.call(null, GV.getPropertyContainer(nodeScopeData, parts[0]), viewNode.node.checked);
      });
    },
    onApply: function (cache, viewNode, value) {
      if (viewNode.node.checked === value) {
        return;
      }

      viewNode.node.checked = value || false;
    }
  };
})(Galaxy.GalaxyView);

