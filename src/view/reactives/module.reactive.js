/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['module'] = {
    regex: null,
    bind: function (viewNode, nodeScopeData, matches) {
      // console.info('bind module');
      // viewNode.root.makeBinding(viewNode, nodeScopeData, '$if', matches);
    },
    onApply: function (cache, viewNode, value) {
      // console.info('apply module', cache, value);
      // if (value) {
      //   viewNode.setInDOM(true);
      // } else {
      //   viewNode.setInDOM(false);
      // }
    }
  };
})(Galaxy.GalaxyView);

