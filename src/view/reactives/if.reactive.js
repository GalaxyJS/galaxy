/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['$if'] = {
    regex: null,
    bind: function (viewNode, nodeScopeData, matches) {
      // debugger;
    },
    onApply: function (cache, viewNode, value) {
      // console.info('apply $if', value);
      if (value) {
        viewNode.setInDOM(true);
      } else {
        viewNode.setInDOM(false);
      }
    }
  };
})(Galaxy.GalaxyView);

