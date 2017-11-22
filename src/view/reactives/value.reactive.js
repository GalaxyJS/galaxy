/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'reactive',
    name: 'value'
  };

  GV.REACTIVE_BEHAVIORS['value'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (nodeScopeData, matches) {
      if (this.node.type === 'text') {
        let parts = matches[1].split('.');
        let setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
        this.node.addEventListener('keyup', function () {
          setter.call(null, GV.getPropertyContainer(nodeScopeData, parts[0]), this.node.value);
        });
      }
    },
    onApply: function (cache, value) {
      if (document.activeElement === this.node && this.node.value === value) {
        return;
      }

      this.node.value = value || '';
    }
  };
})(Galaxy.GalaxyView);

