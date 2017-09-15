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
        moduleMeta: null,
        scope: viewNode.root.scope
      };
    },
    onApply: function (cache, viewNode, moduleMeta) {
      if (!viewNode.virtual && moduleMeta && moduleMeta.url && moduleMeta !== cache.moduleMeta) {
        viewNode.rendered.then(function () {
          const afterEmpty = (function (moduleMeta) {
            return function (done) {
              if (cache.module) {
                cache.module.destroy();
              }

              // Check for circular module loading
              let tempURI = new Galaxy.GalaxyURI(moduleMeta.url);
              let root = viewNode.root;
              while (root.scope) {
                if (tempURI.parsedURL === root.scope.uri.paresdURL) {
                  return console.error('Circular module loading detected and stopped. \n' + cache.scope.uri.paresdURL + ' tries to load itself.');
                }

                root = root.container;
              }

              cache.scope.load(moduleMeta, {
                element: viewNode
              }).then(function (module) {
                cache.module = module;
                viewNode.node.setAttribute('module', module.systemId);
                module.start();
              }).catch(function (response) {
                console.error(response);
              });

              done();
            };
          })(moduleMeta);
          viewNode.empty().next(afterEmpty);
        });
      } else if (!moduleMeta) {
        viewNode.empty();
      }

      cache.moduleMeta = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

