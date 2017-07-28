/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['module'] = {
    type: 'reactive',
    name: 'module'
  };

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
    onApply: function (cache, viewNode, moduleMeta, matches, scopeData) {
      if (!viewNode.virtual && moduleMeta && moduleMeta.url && moduleMeta !== cache.module) {
        viewNode.onReady.then(function () {
          viewNode.empty();
          cache.scope.load(moduleMeta, {
            element: viewNode
          }).then(function (module) {
            viewNode.node.setAttribute('module', module.systemId);
            module.start();
          }).catch(function (response) {
            console.error(response);
          });
        });
      } else if (!moduleMeta) {
        viewNode.empty();
      }

      cache.module = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

