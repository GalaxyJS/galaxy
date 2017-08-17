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
          viewNode.empty().next(function (done) {
            if(cache.module) {
              cache.module.destroy();
            }

            done();

            // Check for circular module loading
            var tempURI = new Galaxy.GalaxyURI(moduleMeta.url);
            var root = viewNode.root;
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
          });
        });
      } else if (!moduleMeta) {
        viewNode.empty();
      }

      cache.moduleMeta = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

