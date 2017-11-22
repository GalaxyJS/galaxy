/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'reactive',
    name: 'checked'
  };

  GV.REACTIVE_BEHAVIORS['checked'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (nodeScopeData, matches) {
      let parts = matches[1].split('.');
      let setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
      this.node.addEventListener('change', function () {
        setter.call(null, GV.getPropertyContainer(nodeScopeData, parts[0]), this.node.checked);
      });
    },
    onApply: function (cache, value) {
      if (this.node.checked === value) {
        return;
      }

      this.node.checked = value || false;
    }
  };
})(Galaxy.GalaxyView);

