/* global Galaxy */

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['arguments'] = {
    type: 'custom',
    name: 'arguments',
    handler: function (viewNode, attr, args, oldEvents, scopeData) {
      if (viewNode.virtual) return;
      if (args instanceof Array) {
        args.forEach(function (item) {
          viewNode.arguments[item] = G.GalaxyView.exactPropertyLookup(scopeData, item);
        });
      }
    }
  };
})(Galaxy);
