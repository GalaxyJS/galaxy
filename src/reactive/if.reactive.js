/* global Galaxy */

(function () {

  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'if' ] = {
    regex: null,
    bind: function (node, nodeSchema, nodeDataScope, matches) {
      this.makeBinding(node, nodeDataScope, 'reactive_if', matches);
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

