/* global Galaxy */

(function () {

  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'if' ] = {
    regex: null,
    bind: function (node, nodeSchema, nodeDataScope, matches) {
      // node._galaxy_view.asTemplate = true;
      // node._galaxy_view.placeholder.nodeValue = JSON.stringify(nodeSchema, null, 2);
      // debugger;
      console.info(node,nodeDataScope);
      this.makeBinding(node, nodeDataScope, 'reactive_if', matches);
    },
    onApply: function (node, nodeSchema, value, matches) {
      // debugger;
      console.info(value, node);
    }
  };
})();

