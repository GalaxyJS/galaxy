/* global Galaxy */
Galaxy.Router = /** @class */ (function (G) {
  Router.PARAMETER_NAME_REGEX = new RegExp(/[:*](\w+)/g);
  Router.PARAMETER_NAME_REPLACEMENT = '([^/]+)';
  Router.BASE_URL = '/';
  Router.currentPath = {
    handlers: [],
    subscribe: function (handler) {
      this.handlers.push(handler);
      handler(location.pathname);
    },
    update: function () {
      this.handlers.forEach((h) => {
        h(location.pathname);
      });
    }
  };

  Router.mainListener = function (e) {
    Router.currentPath.update();
  };

  Router.prepareRoute = function (routeConfig, parentScopeRouter, fullPath) {
    if (routeConfig instanceof Array) {
      const routes = routeConfig.map((r) => Router.prepareRoute(r, parentScopeRouter, fullPath));
      if (parentScopeRouter) {
        parentScopeRouter.activeRoute.children = routes;
      }

      return routes;
    }

    return {
      ...routeConfig,
      fullPath: fullPath + routeConfig.path,
      active: false,
      hidden: routeConfig.hidden || Boolean(routeConfig.redirectTo) || false,
      viewports: routeConfig.viewports || {},
      parent: parentScopeRouter ? parentScopeRouter.activeRoute : null,
      children: routeConfig.children || []
    };
  };

  window.addEventListener('popstate', Router.mainListener);

  /**
   *
   * @param {Galaxy.Scope} scope
   * @param {Galaxy.Module} module
   * @constructor
   * @memberOf Galaxy
   */
  function Router(scope, module) {
    const _this = this;
    _this.__singleton__ = true;
    _this.config = {
      baseURL: Router.BASE_URL
    };
    _this.scope = scope;
    _this.module = module;

    // Find active parent router
    _this.parentRouterScope = scope.parentScope;
    _this.parentRouter = scope.parentScope ? scope.parentScope.__router__ : null

    // ToDo: bug
    if (_this.parentRouterScope && (!_this.parentRouterScope.router || !_this.parentRouterScope.router.activeRoute)) {
      let ps = _this.parentRouterScope;
      while (!ps.router || !ps.router.activeRoute) {
        ps = ps.parentScope;
      }
      _this.config.baseURL = ps.router.activePath;
      _this.parentRouterScope = null;
    }

    _this.path = _this.parentRouterScope && _this.parentRouterScope.router ? _this.parentRouterScope.router.activeRoute.path : '/';
    _this.fullPath = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;
    _this.parentRoute = null;

    _this.oldURL = '';
    _this.resolvedRouteValue = null;
    _this.resolvedDynamicRouteValue = null;

    _this.routesMap = null;
    _this.data = {
      routes: [],
      navs: [],
      activeRoute: null,
      activePath: null,
      activeModule: null,
      viewports: {
        main: null,
      },
      parameters: _this.parentRouterScope && _this.parentRouterScope.router ? _this.parentRouterScope.router.parameters : {}
    };
    _this.onTransitionFn = Galaxy.View.EMPTY_CALL;
    _this.onInvokeFn = Galaxy.View.EMPTY_CALL;
    _this.onLoadFn = Galaxy.View.EMPTY_CALL;

    _this.viewports = {
      main: {
        tag: 'div',
        module: '<>router.activeModule'
      }
    };

    Object.defineProperty(this, 'urlParts', {
      get: function () {
        return _this.oldURL.split('/').slice(1);
      },
      enumerable: true
    });

    if (module.id === '@root') {
      Router.currentPath.update();
    }
  }

  Router.prototype = {
    setup: function (routeConfigs) {
      this.routes = Router.prepareRoute(routeConfigs, this.parentRouterScope ? this.parentRouterScope.router : null, this.fullPath === '/' ? '' : this.fullPath);
      if (this.parentRouterScope && this.parentRouterScope.router) {
        this.parentRoute = this.parentRouterScope.router.activeRoute;
      }

      this.routes.forEach(route => {
        const viewportNames = route.viewports ? Object.keys(route.viewports) : [];
        viewportNames.forEach(vp => {
          if (vp === 'main' || this.viewports[vp]) return;

          this.viewports[vp] = {
            tag: 'div',
            module: '<>router.viewports.' + vp
          };
        });
      });

      this.data.routes = this.routes;
      this.data.navs = this.routes.filter(r => !r.hidden);

      return this;
    },

    start: function () {
      this.listener = this.detect.bind(this);
      window.addEventListener('popstate', this.listener);
      this.detect();
    },

    /**
     *
     * @param {string} path
     * @param {boolean} replace
     */
    navigateToPath: function (path, replace) {
      if (path.indexOf('/') !== 0) {
        throw new Error('Path argument is not starting with a `/`\nplease use `/' + path + '` instead of `' + path + '`');
      }

      if (path.indexOf(this.config.baseURL) !== 0) {
        path = this.config.baseURL + path;
      }

      const currentPath = window.location.pathname;
      if (currentPath === path /*&& this.resolvedRouteValue === path*/) {
        return;
      }

      setTimeout(() => {
        if (replace) {
          history.replaceState({}, '', path);
        } else {
          history.pushState({}, '', path);
        }

        dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      });
    },

    navigate: function (path, replace) {
      if (path.indexOf(this.path) !== 0) {
        path = this.path + path;
      }

      this.navigateToPath(path, replace);
    },

    navigateToRoute: function (route, replace) {
      let path = route.path;
      if (route.parent) {
        path = route.parent.path + route.path;
      }

      this.navigate(path, replace);
    },

    notFound: function () {

    },

    normalizeHash: function (hash) {
      if (hash.indexOf('#!/') === 0) {
        throw new Error('Please use `#/` instead of `#!/` for you hash');
      }

      let normalizedHash = hash;
      if (hash.indexOf('#/') !== 0) {
        if (hash.indexOf('/') !== 0) {
          normalizedHash = '/' + hash;
        } else if (hash.indexOf('#') === 0) {
          normalizedHash = hash.split('#').join('#/');
        }
      }

      // if (this.config.baseURL !== '/') {
      //   normalizedHash = normalizedHash.replace(this.config.baseURL, '');
      // }
      return normalizedHash.replace(this.fullPath, '/').replace('//', '/') || '/';
    },

    onTransition: function (handler) {
      this.onTransitionFn = handler;
      return this;
    },

    onInvoke: function (handler) {
      this.onInvokeFn = handler;
      return this;
    },

    onLoad: function (handler) {
      this.onLoadFn = handler;
      return this;
    },

    findMatchRoute: function (routes, hash, parentParams) {
      const _this = this;
      let matchCount = 0;
      const normalizedHash = _this.normalizeHash(hash);

      const routesPath = routes.map(item => item.path);
      const dynamicRoutes = _this.extractDynamicRoutes(routesPath);
      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const dynamicRoute = dynamicRoutes[i];
        const match = dynamicRoute.paramFinderExpression.exec(normalizedHash);

        if (!match) {
          continue;
        }
        matchCount++;

        const params = _this.createParamValueMap(dynamicRoute.paramNames, match.slice(1));
        if (_this.resolvedDynamicRouteValue === hash) {
          return Object.assign(_this.data.parameters, params);
        }
        _this.resolvedDynamicRouteValue = hash;
        _this.resolvedRouteValue = null;

        const routeIndex = routesPath.indexOf(dynamicRoute.id);
        const pathParameterPlaceholder = dynamicRoute.id.split('/').filter(t => t.indexOf(':') !== 0).join('/');
        const parts = hash.replace(pathParameterPlaceholder, '').split('/');

        const shouldContinue = _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);

        if (!shouldContinue) {
          return;
        }
      }

      const staticRoutes = routes.filter(r => dynamicRoutes.indexOf(r) === -1 && normalizedHash.indexOf(r.path) === 0);
      const staticRoutesPriority = staticRoutes.length ? staticRoutes.reduce((a, b) => a.path.length > b.path.length ? a : b) : false;
      if (staticRoutesPriority && !(normalizedHash !== '/' && staticRoutesPriority.path === '/')) {
        const routeValue = normalizedHash.slice(0, staticRoutesPriority.path.length);

        if (_this.resolvedRouteValue === routeValue) {
          // static routes don't have parameters
          return Object.assign(_this.data.parameters, _this.createClearParameters());
        }
        _this.resolvedDynamicRouteValue = null;
        _this.resolvedRouteValue = routeValue;

        if (staticRoutesPriority.redirectTo) {
          return this.navigate(staticRoutesPriority.redirectTo, true);
        }
        matchCount++;

        return _this.callRoute(staticRoutesPriority, normalizedHash, _this.createClearParameters(), parentParams);
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (route, hash, params, parentParams) {
      const activeRoute = this.data.activeRoute;
      const activePath = this.data.activePath;

      this.onTransitionFn.call(this, activePath, route.path, activeRoute, route);
      if (!route.redirectTo) {
        // if current route's path starts with the old route's path, then the old route should stay active
        if (activeRoute && route.path.indexOf(activePath) !== 0) {
          activeRoute.active = false;

          if (typeof activeRoute.onLeave === 'function') {
            activeRoute.onLeave.call(null, activePath, route.path, activeRoute, route);
          }
        }

        route.active = true;
      }

      if (typeof route.onEnter === 'function') {
        route.onEnter.call(null, activePath, route.path, activeRoute, route);
      }

      this.data.activeRoute = route;
      this.data.activePath = route.path;

      if (typeof route.handle === 'function') {
        return route.handle.call(this, params, parentParams);
      } else {
        this.populateViewports(route);

        G.View.CREATE_IN_NEXT_FRAME(G.View.GET_MAX_INDEX(), (_next) => {
          Object.assign(this.data.parameters, params);
          _next();
        });
      }

      return false;
    },

    populateViewports: function (route) {
      let viewportFound = false;
      const allViewports = this.data.viewports;
      for (const key in allViewports) {
        let value = route.viewports[key];
        if(value === undefined) {
          continue;
        }

        if (typeof value === 'string') {
          value = {
            path: value,
            onInvoke: this.onInvokeFn.bind(this, value, key),
            onLoad: this.onLoadFn.bind(this, value, key)
          };
          viewportFound = true;
        }

        if (key === 'main') {
          this.data.activeModule = value;
        }

        this.data.viewports[key] = value;
      }

      if (!viewportFound && this.parentRouter) {
        this.parentRouter.populateViewports(route);
      }
    },

    createClearParameters: function () {
      const clearParams = {};
      const keys = Object.keys(this.data.parameters);
      keys.forEach(k => clearParams[k] = undefined);
      return clearParams;
    },

    extractDynamicRoutes: function (routesPath) {
      return routesPath.map(function (route) {
        const paramsNames = [];

        // Find all the parameters names in the route
        let match = Router.PARAMETER_NAME_REGEX.exec(route);
        while (match) {
          paramsNames.push(match[1]);
          match = Router.PARAMETER_NAME_REGEX.exec(route);
        }

        if (paramsNames.length) {
          return {
            id: route,
            paramNames: paramsNames,
            paramFinderExpression: new RegExp(route.replace(Router.PARAMETER_NAME_REGEX, Router.PARAMETER_NAME_REPLACEMENT))
          };
        }

        return null;
      }).filter(Boolean);
    },

    createParamValueMap: function (names, values) {
      const params = {};
      names.forEach(function (name, i) {
        params[name] = values[i];
      });

      return params;
    },

    detect: function () {
      const pathname = window.location.pathname;
      const hash = pathname ? pathname.substring(-1) !== '/' ? pathname + '/' : pathname : '/';
      // const hash = pathname || '/';
      const path = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;

      if (hash.indexOf(path) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          this.findMatchRoute(this.routes, hash, {});
        }
      }
    },

    getURLParts: function () {
      return this.oldURL.split('/').slice(1);
    },

    destroy: function () {
      if (this.parentRoute) {
        this.parentRoute.children = [];
      }
      window.removeEventListener('popstate', this.listener);
    }
  };

  return Router;
})(Galaxy);
