/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    regex: null,
    bind: function (viewNode, nodeScopeData, matches) {
      // debugger;
    },
    onApply: function (cache, viewNode, value) {
      // console.info('apply $if', value);
      if (value && !viewNode.inDOM) {
        viewNode.setInDOM(true);
      } else if (!value && viewNode.inDOM) {
        viewNode.setInDOM(false);
      }
    }
  };
})(Galaxy.GalaxyView);

