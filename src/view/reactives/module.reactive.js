/* global Galaxy */

(function (GV) {
  const loadModuleQueue = new Galaxy.GalaxySequence();
  loadModuleQueue.start();

  const moduleLoaderGenerator = function (viewNode, cache, moduleMeta) {
    return function (done) {
      if (cache.module) {
        cache.module.destroy();
      }
      // Check for circular module loading
      let tempURI = new Galaxy.GalaxyURI(moduleMeta.url);
      let scope = cache.scope;

      while (scope) {
        if (tempURI.parsedURL === cache.scope.uri.paresdURL) {
          return console.error('Circular module loading detected and stopped. \n' + cache.scope.uri.paresdURL + ' tries to load itself.');
        }

        scope = scope.parentScope;
      }

      window.requestAnimationFrame(function () {
        cache.scope.load(moduleMeta, {
          element: viewNode
        }).then(function (module) {
          cache.module = module;
          viewNode.node.setAttribute('module', module.systemId);
          module.start();
          done();
        }).catch(function (response) {
          console.error(response);
          done();
        });
      });
    };
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['module'] = {
    type: 'reactive',
    name: 'module'
  };

  GV.REACTIVE_BEHAVIORS['module'] = {
    regex: null,
    bind: function ( nodeScopeData, matches) {
    },
    getCache: function ( matches, scopeData) {
      return {
        module: null,
        moduleMeta: null,
        scope: scopeData
      };
    },
    onApply: function (cache, moduleMeta) {
      const _this = this;

      if (!_this.virtual && moduleMeta && moduleMeta.url && moduleMeta !== cache.moduleMeta) {
        _this.rendered.then(function () {
          // Add the new module request to the sequence
          loadModuleQueue.next(function (nextCall) {
            // Wait till all viewNode animation are done
            console.info('Added to queue:', moduleMeta.id);
            // Empty the node and wait till all animation are finished
            // Then load the next requested module in the queue
            // and after that proceed to next request in the queue
            _this.clean().next(moduleLoaderGenerator(_this, cache, moduleMeta))
              .next(function (done) {
                // module loader may add animations to the viewNode. if that is the case we will wait for the animations
                // to finish at the beginning of the next module request
                done();
                nextCall();
              });
          });
        });
      } else if (!moduleMeta) {
        _this.clean();
      }

      cache.moduleMeta = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

