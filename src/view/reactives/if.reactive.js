/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    bind: function (nodeScopeData, matches,) {
    },
    onApply: function (cache, value, oldValue, scopeData, expression) {
      if (expression) {
        value = expression();
      }

      if (value && !this.inDOM) {
        this.setInDOM(true);
      } else if (!value && this.inDOM) {
        this.setInDOM(false);
      }
    }
  };
})(Galaxy.GalaxyView);

