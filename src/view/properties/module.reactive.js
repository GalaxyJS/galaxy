/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['module'] = {
    type: 'reactive',
    name: 'module'
  };

  GV.REACTIVE_BEHAVIORS['module'] = {
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

      if (!_this.virtual && moduleMeta && moduleMeta.url && moduleMeta !== data.moduleMeta) {
        _this.rendered.then(function () {
          Promise.resolve().then(function () {
            // Only truncate renderingFlow if the node is in the DOM
            if (_this.inDOM) {
              _this.renderingFlow.truncate();
            }

            _this.renderingFlow.nextAction(function () {
              const nodes = _this.getChildNodes();
              _this.clean(_this.sequences.leave);
              _this.sequences.leave.nextAction(function () {
                _this.flush(nodes);
              });

              moduleLoaderGenerator(_this, data, moduleMeta)(function () {});
            });
          });
        });
      } else if (!moduleMeta) {
        Promise.resolve().then(function () {
          _this.renderingFlow.nextAction(function () {
            const nodes = _this.getChildNodes();
            _this.clean(_this.sequences.leave);
            _this.sequences.leave.nextAction(function () {
              _this.flush(nodes);
            });
          });
        });
      }

      data.moduleMeta = moduleMeta;
    }
  };

  const moduleLoaderGenerator = function (viewNode, cache, moduleMeta) {
    return function (done) {
      if (cache.module) {
        cache.module.destroy();
      }
      // Check for circular module loading
      const tempURI = new Galaxy.GalaxyURI(moduleMeta.url);
      let moduleScope = cache.scope;
      let currentScope = cache.scope;

      while (moduleScope) {
        // In the case where module is a part of $for, cache.scope will be NOT an instance of Scope
        // but its __parent__ is
        if (!(currentScope instanceof Galaxy.Scope)) {
          currentScope = new Galaxy.Scope({
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

      Promise.resolve().then(function () {
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
})(Galaxy.View);

