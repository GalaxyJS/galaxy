/* global Galaxy */
(function (G) {
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

    G.View.DESTROY_IN_NEXT_FRAME(viewNode.index, () => {
      viewNode.clean(true);
    });
  }

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['module'] = {
    type: 'reactive',
    name: 'module'
  };

  G.View.REACTIVE_BEHAVIORS['module'] = {
    regex: null,
    prepare: function (matches, scope) {
      return {
        module: null,
        moduleMeta: null,
        scope: scope
      };
    },
    install: function (data) {
      return true;
    },
    apply: function handleModule(data, moduleMeta, oldModuleMeta, expression) {
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

      if (!_this.virtual && moduleMeta && moduleMeta.path && moduleMeta !== data.moduleMeta) {
        _this.rendered.then(function () {
          cleanModuleContent(_this);
          moduleLoaderGenerator(_this, data, moduleMeta)();
        });
      } else if (!moduleMeta) {
        cleanModuleContent(_this);
      }

      data.moduleMeta = moduleMeta;
    }
  };

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

