/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['_module'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['_module'] = {
    type: 'reactive',
    key: '_module',
    getConfig: function (scope) {
      return {
        module: null,
        moduleMeta: null,
        scope: scope
      };
    },
    install: function () {
      return true;
    },
    update: function handleModule(config, newModuleMeta, expression) {
      const _this = this;

      if (expression) {
        newModuleMeta = expression();
      }

      if (newModuleMeta === undefined) {
        return;
      }

      if (typeof newModuleMeta !== 'object') {
        return console.error('_module property only accept objects as value', newModuleMeta);
      }

      if (newModuleMeta && config.moduleMeta && newModuleMeta.path === config.moduleMeta.path) {
        return;
      }

      if (!newModuleMeta || newModuleMeta !== config.moduleMeta) {
        // _this.destroyOrigin = _this;
        G.View.DESTROY_IN_NEXT_FRAME(_this.index, (_next) => {
          cleanModuleContent(_this);
          // _this.destroyOrigin = 0;
          _next();
        });
      }

      if (!_this.virtual && newModuleMeta && newModuleMeta.path && newModuleMeta !== config.moduleMeta) {
        G.View.CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          moduleLoaderGenerator(_this, config, newModuleMeta, _next)();
        });
      }
      config.moduleMeta = newModuleMeta;
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   */
  function cleanModuleContent(viewNode) {
    const children = viewNode.getChildNodes();
    children.forEach(vn => {
      // console.log(vn);
      if (vn.populateLeaveSequence === Galaxy.View.EMPTY_CALL) {
        vn.populateLeaveSequence = function (finalize) {
          finalize();
        };
      }
    });

    viewNode.clean(true);
  }

  const moduleLoaderGenerator = function (viewNode, cache, moduleMeta, _next) {
    return function () {
      if (cache.module) {
        cache.module.destroy();
      }
      // Check for circular module loading
      const tempURI = new G.GalaxyURI(moduleMeta.path);
      let moduleScope = cache.scope;
      let currentScope = cache.scope;

      while (moduleScope) {
        // In the case where module is a part of _repeat, cache.scope will be NOT an instance of Scope
        // but its __parent__ is
        if (!(currentScope instanceof G.Scope)) {
          currentScope = new G.Scope({
            systemId: 'repeat-item',
            path: cache.scope.__parent__.uri.parsedURL,
            parentScope: cache.scope.__parent__
          });
        }

        if (tempURI.parsedURL === currentScope.uri.parsedURL) {
          return console.error('Circular module loading detected and stopped. \n' + currentScope.uri.parsedURL + ' tries to load itself.');
        }

        moduleScope = moduleScope.parentScope;
      }

      // G.View.CREATE_IN_NEXT_FRAME(viewNode.index, () => {
      currentScope.load(moduleMeta, {
        element: viewNode
      }).then(function (module) {
        cache.module = module;
        viewNode.node.setAttribute('module', module.systemId);
        module.start();
        _next();
      }).catch(function (response) {
        console.error(response);
        _next();
      });
      // });
    };
  };
})(Galaxy);

