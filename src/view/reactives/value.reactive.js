/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'reactive',
    name: 'value'
  };

  GV.REACTIVE_BEHAVIORS['value'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (viewNode, nodeScopeData, matches) {
      if (viewNode.node.type === 'text') {
        let parts = matches[1].split('.');
        let setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
        viewNode.node.addEventListener('keyup', function () {
          setter.call(null, GV.getPropertyContainer(nodeScopeData, parts[0]), viewNode.node.value);
        });
      }
    },
    onApply: function (cache, viewNode, value) {
      if (document.activeElement === viewNode.node && viewNode.node.value === value) {
        return;
      }

      viewNode.node.value = value || '';
    }
  };
})(Galaxy.GalaxyView);

