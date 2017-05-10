/* global Galaxy */

(function () {
  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'for' ] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (galaxyView, nodeScopeData, matches) {
      galaxyView.toTemplate();
      this.makeBinding(galaxyView.node, nodeScopeData, 'reactive_for', matches[ 2 ]);
    },
    onApply: function (galaxyView, value, matches, nodeScopeData) {
      var oldItems = galaxyView.forItems || [];
      var newItems = [];
      oldItems.forEach(function (node) {
        node.__galaxyView__.destroy();
      });

      var newNodeSchema = JSON.parse(JSON.stringify(galaxyView.nodeSchema));
      delete newNodeSchema.reactive.for;
      var parentNode = galaxyView.placeholder.parentNode;

      for (var index in value) {
        var itemDataScope = Object.assign({}, nodeScopeData);
        itemDataScope[ matches[ 1 ] ] = value[ index ];
        newItems.push(this.append(newNodeSchema, itemDataScope, parentNode));
      }

      galaxyView.forItems = newItems;
    }
  };
})();

