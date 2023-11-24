import { EMPTY_CALL } from '../utils.js';
import GalaxyURI from '../uri.js';
import Scope from '../scope.js';
import { create_in_next_frame } from '../view.js';

export const module_property = {
  type: 'reactive',
  key: 'module',
  getConfig: function (scope) {
    return {
      previousModule: null,
      moduleMeta: null,
      scope: scope
    };
  },
  install: function () {
    return true;
  },

  /**
   *
   * @param cache
   * @param {Galaxy.ModuleMetaData} newModuleMeta
   * @param expression
   */
  update: function handleModule(cache, newModuleMeta, expression) {
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

    if (newModuleMeta && cache.moduleMeta && newModuleMeta.path === cache.moduleMeta.path) {
      return;
    }

    if (!newModuleMeta || newModuleMeta !== cache.moduleMeta) {
      // When this node has a `if`, calling `clean_content(this)` inside a destroy_in_next_frame cause the animation
      // of this node to be executed before the animations of its children, which is not correct.
      // Calling `clean_content(this)` directly fixes this issue, however it might cause other issues when
      // this node does not use `if`. Therefore, we make sure both cases are covered.
      // if (_this.blueprint.hasOwnProperty('if')) {
      // ToDo: Make this works properly
      clean_content(_this);
      if (cache.loadedModule) {
        cache.loadedModule.destroy();
        cache.loadedModule = null;
      }
    }

    if (!_this.virtual && newModuleMeta && newModuleMeta.path && newModuleMeta !== cache.moduleMeta) {
      create_in_next_frame(_this.index, (_next) => {
        module_loader.call(null, _this, cache, newModuleMeta, _next);
      });
    }
    cache.moduleMeta = newModuleMeta;
  }
};

/**
 *
 * @param {Galaxy.ViewNode} viewNode
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

  viewNode.clean(viewNode.hasAnimation(children));
}

/**
 *
 * @param viewNode
 * @param cache
 * @param {object} moduleMeta
 * @param _next
 */
function module_loader(viewNode, cache, moduleMeta, _next) {
  // if (cache.module) {
  //   cache.module.destroy();
  // }
  // Check for circular module loading
  const tempURI = new GalaxyURI(moduleMeta.path);
  let moduleScope = cache.scope;
  let currentScope = cache.scope;

  if (typeof moduleMeta.onInvoke === 'function') {
    moduleMeta.onInvoke.call();
  }

  while (moduleScope) {
    // In the case where module is a part of repeat, cache.scope will NOT be an instance of Scope
    // but its __parent__ will be
    if (!(currentScope instanceof Scope)) {
      currentScope = new Scope(cache.scope.__parent__.context, {
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
    cache.loadedModule = module;
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

