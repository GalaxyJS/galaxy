/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['module'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['module'] = {
    type: 'reactive',
    key: 'module',
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
    update: function handleModule(config, moduleMeta, oldModuleMeta, expression) {
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

      if (moduleMeta && oldModuleMeta && moduleMeta.path === oldModuleMeta.path) {
        return;
      }

      if (!_this.virtual && moduleMeta && moduleMeta.path && moduleMeta !== config.moduleMeta) {
        // G.View.CREATE_IN_NEXT_FRAME(_this.index, () => {
        _this.rendered.then(function () {
          cleanModuleContent(_this);
          moduleLoaderGenerator(_this, config, moduleMeta)();
        });
        // });
      } else if (!moduleMeta) {
        cleanModuleContent(_this);
      }
      config.moduleMeta = moduleMeta;
    }
  };

  function cleanModuleContent(viewNode) {
    const children = viewNode.getChildNodes();
    children.forEach(vn => {
      if (vn.populateLeaveSequence === Galaxy.View.EMPTY_CALL) {
        vn.populateLeaveSequence = function (onComplete) {
          G.View.AnimationMeta.installGSAPAnimation(vn, 'leave', {
            sequence: 'DESTROY',
            duration: .000001
          }, {}, onComplete);
        };
      }
    });
    // G.View.DESTROY_IN_NEXT_FRAME(viewNode.index, () => {
    viewNode.clean(true);
    // });
  }

  const moduleLoaderGenerator = function (viewNode, cache, moduleMeta) {
    return function () {
      if (cache.module) {
        cache.module.destroy();
      }
      // Check for circular module loading
      const tempURI = new G.GalaxyURI(moduleMeta.path);
      let moduleScope = cache.scope;
      let currentScope = cache.scope;

      while (moduleScope) {
        // In the case where module is a part of repeat, cache.scope will be NOT an instance of Scope
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

      G.View.CREATE_IN_NEXT_FRAME(viewNode.index, () => {
        currentScope.load(moduleMeta, {
          element: viewNode
        }).then(function (module) {
          cache.module = module;
          viewNode.node.setAttribute('module', module.systemId);
          module.start();
        }).catch(function (response) {
          console.error(response);
        });
      });
    };
  };
})(Galaxy);

