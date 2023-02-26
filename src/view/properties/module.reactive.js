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
    update: function handleModule(config, newModuleMeta, expression) {
      const _this = this;

      if (expression) {
        newModuleMeta = expression();
      }

      if (newModuleMeta === undefined) {
        return;
      }

      if (typeof newModuleMeta !== 'object') {
        return console.error('module property only accept objects as value', newModuleMeta);
      }

      if (newModuleMeta && config.moduleMeta && newModuleMeta.path === config.moduleMeta.path) {
        return;
      }

      if (!newModuleMeta || newModuleMeta !== config.moduleMeta) {
        // When this node has a `if`, calling `clean_content(this)` inside a destroy_in_next_frame cause the animation
        // of this node to be executed before the animations of its children, which is not correct.
        // Calling `clean_content(this)` directly fixes this issue, however it might cause other issues when
        // this node does not use `if`. Therefore, we make sure both cases are covered.
        // if (_this.blueprint.hasOwnProperty('if')) {
        // ToDo: Make this works properly
        clean_content(_this);
        // } else {
        //   G.View.destroy_in_next_frame(_this.index, (_next) => {
        //     clean_content(_this);
        //     _next();
        //   });
        // }
      }

      if (!_this.virtual && newModuleMeta && newModuleMeta.path && newModuleMeta !== config.moduleMeta) {
        G.View.create_in_next_frame(_this.index, (_next) => {
          module_loader.call(null, _this, config, newModuleMeta, _next);
        });
      }
      config.moduleMeta = newModuleMeta;
    }
  };

  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   */
  function clean_content(viewNode) {
    const children = viewNode.getChildNodes();
    for (let i = 0, len = children.length; i < len; i++) {
      const vn = children[i];
      if (vn.processLeaveAnimation === EMPTY_CALL) {
        vn.processLeaveAnimation = function (finalize) {
          finalize();
        };
      }
    }

    viewNode.clean(true);

    // G.View.destroy_in_next_frame(viewNode.index, (_next) => {
    //   let len = viewNode.finalize.length;
    //   for (let i = 0; i < len; i++) {
    //     viewNode.finalize[i].call(viewNode);
    //   }
    //   viewNode.finalize = [];
    //   _next();
    // });
  }

  /**
   *
   * @param viewNode
   * @param cache
   * @param {object} moduleMeta
   * @param _next
   */
  function module_loader(viewNode, cache, moduleMeta, _next) {
    if (cache.module) {
      cache.module.destroy();
    }
    // Check for circular module loading
    const tempURI = new G.GalaxyURI(moduleMeta.path);
    let moduleScope = cache.scope;
    let currentScope = cache.scope;

    if (typeof moduleMeta.onInvoke === 'function') {
      moduleMeta.onInvoke.call();
    }

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

    currentScope.load(moduleMeta, {
      element: viewNode
    }).then(function (module) {
      cache.module = module;
      viewNode.node.setAttribute('module', module.path);
      module.start();

      if (typeof moduleMeta.onLoad === 'function') {
        moduleMeta.onLoad.call();
      }

      _next();
    }).catch(function (response) {
      console.error(response);
      _next();
    });
  }
})(Galaxy);

