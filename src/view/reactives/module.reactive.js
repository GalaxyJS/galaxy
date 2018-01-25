/* global Galaxy */

(function (GV) {
  const loadModuleQueue = new Galaxy.GalaxySequence();
  // loadModuleQueue.start();

  const moduleLoaderGenerator = function (viewNode, cache, moduleMeta) {
    // viewNode.renderingFlow.truncate();
    return function (done) {
      // viewNode.renderingFlow.truncate();
      if (cache.module) {
        cache.module.destroy();
      }
      // Check for circular module loading
      const tempURI = new Galaxy.GalaxyURI(moduleMeta.url);
      let moduleScope = cache.scope;
      let currentScope = cache.scope;

      while (moduleScope) {
        // In the case where module is a part of $for, cache.scope will be NOT an instance of GalaxyScope
        // but its __parent__ is
        if (!(currentScope instanceof Galaxy.GalaxyScope)) {
          currentScope = new Galaxy.GalaxyScope({
            systemId: '$for-item',
            url: moduleMeta.url,
            parentScope: cache.scope.__parent__
          });
        }

        if (tempURI.parsedURL === currentScope.uri.paresdURL) {
          return console.error('Circular module loading detected and stopped. \n' + currentScope.uri.paresdURL + ' tries to load itself.');
        }

        moduleScope = moduleScope.parentScope;
      }

      window.requestAnimationFrame(function () {
        viewNode.renderingFlow.truncate();
        currentScope.load(moduleMeta, {
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
    bind: function (context, value) {
      // if (value !== null && typeof  value !== 'object') {
      //   throw console.error('module property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      // }
      //
      // const live = GV.bindSubjectsToData(value, context, true);
      // this.addDependedObject(live);
    },
    getCache: function (matches, scope) {
      return {
        module: null,
        moduleMeta: null,
        scope: scope
      };
    },
    onApply: function handleModule(cache, moduleMeta, oldModuleMeta, nodeScopeData, expression) {
      const _this = this;

      if (expression) {
        moduleMeta = expression();
      }

      if (typeof moduleMeta !== 'object') {
        return console.error('module property only accept objects as value');
      }

      if (!_this.virtual && moduleMeta && moduleMeta.url && moduleMeta !== cache.moduleMeta) {
        _this.rendered.then(function () {
          // loadModuleQueue.truncate();
          // Add the new module request to the sequence
          // loadModuleQueue.next(function (nextCall) {
          // Wait till all viewNode animation are done
          // console.info('Added to queue:', moduleMeta.id || moduleMeta.url);
          // Empty the node and wait till all animation are finished
          // Then load the next requested module in the queue
          // and after that proceed to next request in the queue
          // debugger;
          _this.renderingFlow.truncate();
          // debugger;
          _this.clean();

          moduleLoaderGenerator(_this, cache, moduleMeta)(function () {
            // debugger;
          });
          // _this.renderingFlow.truncate();
          // .next(function (done) {
          //   debugger;
          //   done();
          // })
          // .next(moduleLoaderGenerator(_this, cache, moduleMeta))
          // .next(function (done) {
          //   // module loader may add animations to the viewNode. if that is the case we will wait for the animations
          //   // to finish at the beginning of the next module request
          //   done();
          //
          //   // nextCall();
          // });
          // });
        });
      } else if (!moduleMeta) {
        _this.clean();
      }

      cache.moduleMeta = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

