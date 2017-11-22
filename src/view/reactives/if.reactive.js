/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    regex: null,
    bind: function (nodeScopeData, matches) {
    },
    onApply: function (cache, value) {
      if (value && !this.inDOM) {
        this.setInDOM(true);
      } else if (!value && this.inDOM) {
        this.setInDOM(false);
      }
    }
  };
})(Galaxy.GalaxyView);

