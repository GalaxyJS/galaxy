/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'reactive',
    name: 'checked'
  };

  GV.REACTIVE_BEHAVIORS['checked'] = {
    regex: GV.BINDING_SYNTAX_REGEX,
    bind: function (nodeScopeData, matches) {
      const _this = this;
      let parts = matches[1].split('.');
      let setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
      _this.node.addEventListener('change', function () {
        setter.call(null, GV.getPropertyContainer(nodeScopeData, parts[0]), _this.node.checked);
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

