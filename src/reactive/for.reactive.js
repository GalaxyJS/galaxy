/* global Galaxy */

(function () {
  // Galaxy.extends(ForReactiveBehavior, Galaxy.GalaxyView.ReactiveBehavior);
  //
  // function ForReactiveBehavior () {
  //
  // }

  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'for' ] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (node, nodeSchema, nodeDataScope, matches) {
      node._galaxy_view.asTemplate = true;
      node._galaxy_view.placeholder.nodeValue = JSON.stringify(nodeSchema, null, 2);
      this.makeBinding(node, nodeDataScope, 'reactive_for', matches[ 2 ]);
    },
    onApply: function (node, nodeSchema, value, matches, scopeData) {
      var oldItems = node._galaxy_view.forItems || [];
      var newItems = [];
      oldItems.forEach(function (node) {
        node._galaxy_view.destroy();
      });

      var newNodeSchema = Object.assign({}, nodeSchema);
      delete newNodeSchema.reactive.for;

      var parentNode = node._galaxy_view.placeholder.parentNode;

      for (var index in value) {
        var itemDataScope = Object.assign({}, scopeData);
        itemDataScope[ matches[ 1 ] ] = value[ index ];

        newItems.push(this.append(newNodeSchema, itemDataScope, parentNode));
      }

      node._galaxy_view.forItems = newItems;
    }
  };
})();

