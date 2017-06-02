/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['module'] = {
    regex: null,
    bind: function (viewNode, nodeScopeData, matches) {
    },
    getCache: function (viewNode) {
      return {
        module: null,
        scope: viewNode.root.scope
      };
    },
    onApply: function (cache, viewNode, value, matches, scopeData) {
      if (!viewNode.template && value && value.url && value !== cache.module) {
        viewNode.empty();
        cache.module = value;
        cache.scope.loadModuleInto(value, viewNode.node).then(function (module) {
          viewNode.node.setAttribute('module', module.systemId);
          viewNode.root.append(viewNode.nodeSchema.children, scopeData, viewNode.node);
        });
      }
    }
  };
})(Galaxy.GalaxyView);

