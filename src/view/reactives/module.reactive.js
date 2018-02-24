/* global Galaxy */

(function (GV) {
  // const loadModuleQueue = new Galaxy.GalaxySequence();
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

      if (moduleMeta === undefined) {
        return;
      }

      if (typeof moduleMeta !== 'object') {
        return console.error('module property only accept objects as value', moduleMeta);
      }

      if (!_this.virtual && moduleMeta && moduleMeta.url && moduleMeta !== cache.moduleMeta) {
        _this.rendered.then(function () {
          _this.renderingFlow.truncate();
          _this.clean();

          moduleLoaderGenerator(_this, cache, moduleMeta)(function () {});
        });
      } else if (!moduleMeta) {
        _this.clean();
      }

      cache.moduleMeta = moduleMeta;
    }
  };
})(Galaxy.GalaxyView);

