/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS[ 'if' ] = {
    regex: null,
    bind: function (viewNode, nodeScopeData, matches) {
      this.makeBinding(viewNode, nodeScopeData, 'reactive_if', matches);
    },
    onApply: function (viewNode, value) {
      if (value) {
        viewNode.setInDOM(true);
      } else {
        viewNode.setInDOM(false);
      }
    }
  };
})(Galaxy.GalaxyView);

