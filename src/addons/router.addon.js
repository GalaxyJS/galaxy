(function (G) {
  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  SimpleRouter.BASE_URL = '/';
  SimpleRouter.currentPath = {
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

  SimpleRouter.mainListener = function (e) {
    SimpleRouter.currentPath.update();
  };

  SimpleRouter.prepareRoute = function (routeConfig, parentScope) {
    if (routeConfig instanceof Array) {
      const routes = routeConfig.map((r) => SimpleRouter.prepareRoute(r, parentScope));
      if (parentScope && parentScope.router) {
        parentScope.router.activeRoute.children = routes;
      }

      return routes;
    }

    return {
      ...routeConfig,
      active: false,
      hidden: routeConfig.hidden || Boolean(routeConfig.redirectTo) || false,
      module: routeConfig.module || null,
      parent: parentScope ? parentScope.router.activeRoute : null,
      children: routeConfig.children || []
    };
  };

  window.addEventListener('popstate', SimpleRouter.mainListener);

  function SimpleRouter(scope, module) {
    const _this = this;
    _this.config = {
      baseURL: SimpleRouter.BASE_URL
    };
    _this.scope = scope;
    _this.module = module;
    _this.path = module.id === 'system' ? '/' : scope.parentScope.router.activeRoute.path;
    _this.fullPath = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;
    _this.parentRoute = null;

    _this.oldURL = '';
    _this.resolvedRouteValue = null;
    _this.resolvedDynamicRouteValue = null;

    _this.routesMap = null;
    _this.data = {
      routes: [],
      activeRoute: null,
      activePath: null,
      activeModule: null,
      parameters: _this.scope.parentScope && _this.scope.parentScope.router ? _this.scope.parentScope.router.parameters : {}
    };
    _this.viewport = {
      tag: 'main',
      _module: '<>router.activeModule'
    };

    Object.defineProperty(this, 'urlParts', {
      get: function () {
        return _this.oldURL.split('/').slice(1);
      },
      enumerable: true
    });

    if (module.id === 'system') {
      SimpleRouter.currentPath.update();
    }
  }

  SimpleRouter.prototype = {
    init: function (routeConfigs) {
      this.routes = SimpleRouter.prepareRoute(routeConfigs, this.scope.parentScope);
      if (this.scope.parentScope && this.scope.parentScope.router) {
        this.parentRoute = this.scope.parentScope.router.activeRoute;
      }
      this.data.routes = this.routes;

      this.listener = this.detect.bind(this);
      window.addEventListener('popstate', this.listener);

      return this;
    },

    start: function () {
      this.detect();
    },

    navigateToPath: function (path, replace) {
      if (path.indexOf('/') !== 0) {
        throw console.error('Path argument is not starting with a `/`\nplease use `/' + path + '` instead of `' + path + '`');
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

    onProceed: function () {

    },

    callMatchRoute: function (routes, hash, parentParams) {
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

      const staticRoutes = routes.filter(r => dynamicRoutes.indexOf(r) === -1 && normalizedHash.indexOf(r.path) === 0).reduce((a, b) => a.path.length > b.path.length ? a : b);
      // debugger
      if (staticRoutes) {
        const routeValue = normalizedHash.slice(0, staticRoutes.path.length);
        if (_this.resolvedRouteValue === routeValue) {
          // static routes don't have parameters
          return Object.assign(_this.data.parameters, _this.createClearParameters());
        }
        _this.resolvedDynamicRouteValue = null;
        _this.resolvedRouteValue = routeValue;

        if (staticRoutes.redirectTo) {
          return this.navigate(staticRoutes.redirectTo, true);
        }
        matchCount++;

        return _this.callRoute(staticRoutes, normalizedHash, _this.createClearParameters(), parentParams);
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (route, hash, params, parentParams) {
      if (!route.redirectTo) {
        if (this.data.activeRoute) {
          this.data.activeRoute.active = false;
        }

        route.active = true;
      }

      this.data.activeRoute = route;
      this.data.activePath = route.path;

      if (typeof route.handle === 'function') {
        return route.handle.call(this, params, parentParams);
      } else {
        this.data.activeModule = route.module;
        G.View.CREATE_IN_NEXT_FRAME(G.View.GET_MAX_INDEX(), (next) => {
          Object.assign(this.data.parameters, params);
          next();
        });
      }

      return false;
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
        let match = SimpleRouter.PARAMETER_REGEXP.exec(route);
        while (match) {
          paramsNames.push(match[1]);
          match = SimpleRouter.PARAMETER_REGEXP.exec(route);
        }

        if (paramsNames.length) {
          return {
            id: route,
            paramNames: paramsNames,
            paramFinderExpression: new RegExp(route.replace(SimpleRouter.PARAMETER_REGEXP, SimpleRouter.REPLACE_VARIABLE_REGEXP))
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
      const hash = window.location.pathname || '/';
      const path = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;

      if (hash.indexOf(path) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          this.callMatchRoute(this.routes, hash, {});
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

  G.registerAddOnProvider('galaxy/router', function (scope, module) {
    return {
      create: function () {
        const router = new SimpleRouter(scope, module);
        if (module.systemId !== 'system') {
          scope.on('module.destroy', () => router.destroy());
        }

        scope.router = router.data;

        return router;
      },
      start: function () { }
    };
  });

  G.Router = SimpleRouter;

})(Galaxy);
