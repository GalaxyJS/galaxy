/* global Galaxy */

(function () {
  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'for' ] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    getScopeData: function (scopeData) {
      return scopeData;
    },
    bind: function (node, nodeSchema, nodeScopeData, matches) {
      node._galaxy_view.toTemplate();
      this.makeBinding(node, nodeScopeData, 'reactive_for', matches[ 2 ]);
    },
    onApply: function (node, nodeSchema, value, matches, nodeScopeData) {
      var oldItems = node._galaxy_view.forItems || [];
      var newItems = [];
      oldItems.forEach(function (node) {
        node._galaxy_view.destroy();
      });

      var newNodeSchema = JSON.parse(JSON.stringify(nodeSchema));
      delete newNodeSchema.reactive.for;
      var parentNode = node._galaxy_view.placeholder.parentNode;

      for (var index in value) {
        var itemDataScope = Object.assign({}, nodeScopeData);
        itemDataScope[ matches[ 1 ] ] = value[ index ];
        newItems.push(this.append(newNodeSchema, itemDataScope, parentNode));
      }

      node._galaxy_view.forItems = newItems;
    }
  };
})();

