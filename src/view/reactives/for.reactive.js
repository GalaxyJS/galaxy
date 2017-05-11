/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS[ 'for' ] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (viewNode, nodeScopeData, matches) {
      viewNode.toTemplate();
      this.makeBinding(viewNode, nodeScopeData, 'reactive_for', matches[ 2 ]);
    },
    onApply: function (viewNode, value, matches, nodeScopeData) {
      var oldItems = viewNode.forItems || [];
      var newItems = [];

      console.info(oldItems)

      oldItems.forEach(function (node) {
        node.destroy();
      });

      // var newNodeSchema2 = JSON.parse(JSON.stringify(galaxyView.nodeSchema));
      var newNodeSchema = Galaxy.extend({}, viewNode.nodeSchema);


      delete newNodeSchema.reactive.for;
      var parentNode = viewNode.placeholder.parentNode;

      for (var index in value) {
        var itemDataScope = Object.assign({}, nodeScopeData);
        itemDataScope[ matches[ 1 ] ] = value[ index ];
        newItems.push(this.append(newNodeSchema, itemDataScope, parentNode));
      }

      console.info(newItems)

      viewNode.forItems = newItems;
    }
  };
})(Galaxy.GalaxyView);

