/* global Galaxy */

(function () {

  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'if' ] = {
    regex: null,
    getScopeData: function (scopeData) {
      return scopeData;
    },
    bind: function (node, nodeSchema, nodeScopeData, matches) {
      this.makeBinding(node, nodeScopeData, 'reactive_if', matches);
    },
    onApply: function (node, nodeSchema, value) {
      if (value) {
        node._galaxy_view.setInDOM(true);
      } else {
        node._galaxy_view.setInDOM(false);
      }
    }
  };
})();

