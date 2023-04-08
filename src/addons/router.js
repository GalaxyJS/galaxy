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
  Router.TITLE_SEPARATOR = ' | ';

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

  Router.extract_dynamic_routes = function (routesPath) {
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
    _this.title = '';
    _this.scope = scope;
    _this.module = module;
    _this.routes = [];
    // Find active parent router
    _this.parentScope = scope.parentScope;
    _this.parentRouter = scope.parentScope ? scope.parentScope.__router__ : null;

    // ToDo: bug
    // Find the next parent router if there is no direct parent router
    if (_this.parentScope && (!_this.parentScope.router || !_this.parentScope.router.activeRoute)) {
      let _parentScope = _this.parentScope;
      while (!_parentScope.router || !_parentScope.router.activeRoute) {
        _parentScope = _parentScope.parentScope;
      }
      // This line cause a bug
      // _this.config.baseURL = _parentScope.router.activePath;
      _this.parentScope = _parentScope;
      _this.parentRouter = _parentScope.__router__ ;
    }

    _this.path = _this.parentScope && _this.parentScope.router ? _this.parentScope.router.activeRoute.path : '/';
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
      parameters: _this.parentScope && _this.parentScope.router ? _this.parentScope.router.parameters : {}
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
      this.routes = Router.prepareRoute(routeConfigs, this.parentScope ? this.parentScope.router : null, this.fullPath === '/' ? '' : this.fullPath);
      if (this.parentScope && this.parentScope.router) {
        this.parentRoute = this.parentScope.router.activeRoute;
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

    setTitle(title) {
      this.title = title;
    },

    getTitle(title) {
      if (this.parentRouter) {
        return this.parentRouter.getTitle() + Router.TITLE_SEPARATOR + (title || this.title);
      }

      return (title || this.title);
    },

    /**
     *
     * @param {string} path
     * @param {boolean} replace
     */
    navigateToPath: function (path, replace) {
      if (typeof path !== 'string') {
        throw new Error('Invalid argument(s) for `navigateToPath`: path must be a string. ' + typeof path + ' is given');
      }

      if (path.indexOf('/') !== 0) {
        throw new Error('Invalid argument(s) for `navigateToPath`: path must be starting with a `/`\nPlease use `/' + path + '` instead of `' + path + '`');
      }

      if (path.indexOf(this.config.baseURL) !== 0) {
        path = this.config.baseURL + path;
      }

      const currentPath = window.location.pathname;
      if (currentPath === path /*&& this.resolvedRouteValue === path*/) {
        return;
      }

      if (replace) {
        history.replaceState({}, '', path);
      } else {
        history.pushState({}, '', path);
      }

      dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    },

    navigate: function (path, replace) {
      if (typeof path !== 'string') {
        throw new Error('Invalid argument(s) for `navigate`: path must be a string. ' + typeof path + ' is given');
      }

      if (path.indexOf('/') !== 0) {
        throw new Error('Invalid argument(s) for `navigate`: path must be starting with a `/`\nPlease use `/' + path + '` instead of `' + path + '`');
      }

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
      const dynamicRoutes = Router.extract_dynamic_routes(routesPath);
      const staticRoutes = routes.filter(r => dynamicRoutes.indexOf(r) === -1 && normalizedHash.indexOf(r.path) === 0);
      const targetStaticRoute = staticRoutes.length ? staticRoutes.reduce((a, b) => a.path.length > b.path.length ? a : b) : false;

      if (targetStaticRoute && !(normalizedHash !== '/' && targetStaticRoute.path === '/')) {
        const routeValue = normalizedHash.slice(0, targetStaticRoute.path.length);

        if (_this.resolvedRouteValue === routeValue) {
          // static routes don't have parameters
          return Object.assign(_this.data.parameters, _this.createClearParameters());
        }

        _this.resolvedDynamicRouteValue = null;
        _this.resolvedRouteValue = routeValue;

        if (targetStaticRoute.redirectTo) {
          return this.navigate(targetStaticRoute.redirectTo, true);
        }

        matchCount++;
        return _this.callRoute(targetStaticRoute, normalizedHash, _this.createClearParameters(), parentParams);
      }

      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const targetDynamicRoute = dynamicRoutes[i];
        const match = targetDynamicRoute.paramFinderExpression.exec(normalizedHash);

        if (!match) {
          continue;
        }

        matchCount++;
        const params = _this.createParamValueMap(targetDynamicRoute.paramNames, match.slice(1));

        if (_this.resolvedDynamicRouteValue === hash) {
          return Object.assign(_this.data.parameters, params);
        }

        _this.resolvedDynamicRouteValue = hash;
        _this.resolvedRouteValue = null;
        const routeIndex = routesPath.indexOf(targetDynamicRoute.id);
        const pathParameterPlaceholder = targetDynamicRoute.id.split('/').filter(t => t.indexOf(':') !== 0).join('/');
        const parts = hash.replace(pathParameterPlaceholder, '').split('/');
        return _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (newRoute, hash, params, parentParams) {
      const oldRoute = this.data.activeRoute;
      const oldPath = this.data.activePath;
      this.data.activeRoute = newRoute;
      this.data.activePath = newRoute.path;

      this.onTransitionFn.call(this, oldPath, newRoute.path, oldRoute, newRoute);
      if (!newRoute.redirectTo) {
        // if current route's path starts with the old route's path, then the old route should stay active
        if (oldRoute && newRoute.path.indexOf(oldPath) !== 0) {
          oldRoute.active = false;

          if (typeof oldRoute.onLeave === 'function') {
            oldRoute.onLeave.call(null, oldPath, newRoute.path, oldRoute, newRoute);
          }
        }

        newRoute.active = true;
      }

      if (typeof newRoute.onEnter === 'function') {
        newRoute.onEnter.call(null, oldPath, newRoute.path, oldRoute, newRoute);
      }

      document.title = this.getTitle(newRoute.title || '');
      if (typeof newRoute.handle === 'function') {
        return newRoute.handle.call(this, params, parentParams);
      } else {
        this.populateViewports(newRoute);

        G.View.create_in_next_frame(G.View.GET_MAX_INDEX(), (_next) => {
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
        if (value === undefined) {
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
