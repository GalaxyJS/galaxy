(function (G) {
  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  // SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  // SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  // SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  // SimpleRouter.MATCH_REGEXP_FLAGS = '';

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

  window.addEventListener('popstate', SimpleRouter.mainListener);

  function SimpleRouter(scope, module) {
    const _this = this;
    _this.config = {
      baseURL: '/'
    };
    _this.scope = scope;
    _this.module = module;
    _this.root = module.id === 'system' ? '/' : location.pathname;
    _this.oldURL = '';
    _this.oldResolveId = null;

    _this.routesMap = null;
    _this.data = {
      routes: [],
      activeLink: null,
      activeRoute: null,
      activeModule: null
    };
    _this.viewport = {
      tag: 'main',
      module: '<>data.router.activeModule'
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
    init: function (routes) {
      this.routes = routes.map(route => {
        return {
          ...route,
          module: route.module || null,
          hidden: route.hidden || false,
          children: route.children || []
        };
      });
      this.data.routes = this.routes.filter(r => !r.hidden);

      if (this.scope.parentScope && this.scope.parentScope.data.router.activeLink) {
        this.scope.parentScope.data.router.activeLink.children = this.routes;
      }

      this.listener = this.detect.bind(this);
      window.addEventListener('popstate', this.listener);

      return this;
    },

    start: function () {
      debugger;
      this.detect();
    },

    navigate: function (path) {
      if (path.indexOf('/') !== 0) {
        throw console.error('Path argument is not starting with a `/`\nplease use `/' + path + '` instead of `' + path + '`');
      }

      if (path.indexOf(this.config.baseURL) !== 0) {
        path = this.config.baseURL + path;
      }

      history.pushState({}, '', path);
      const popStateEvent = new PopStateEvent('popstate', { state: {} });
      dispatchEvent(popStateEvent);
    },

    navigateFromHere: function (path) {
      if (path.indexOf(this.root) !== 0) {
        path = this.root + path;
      }

      this.navigate(path);
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

      normalizedHash = normalizedHash.replace(this.config.baseURL, '/');
      return normalizedHash.replace(this.root, '/') || '/';
    },

    onProceed: function () {

    },

    callMatchRoute: function (routes, hash, parentParams) {
      const _this = this;
      const path = _this.normalizeHash(hash);

      const routesPath = routes.map(function (item) {
        return item.route;
      });

      // Hard match
      const routeIndex = routesPath.indexOf(path);
      if (routeIndex !== -1) {
        debugger
        const route = routes[routeIndex];
        if (route.redirectTo) {
          return this.navigateFromHere(route.redirectTo);
        }
        // const act = routes[routeIndex].act;
        // // delete all old resolved ids
        // if (typeof act === 'string') {
        //   return this.navigateFromHere(act);
        // }

        _this.oldResolveId = null;
        // return act.call(null, {}, parentParams);
        return _this.callRoute(route, path, {}, parentParams);
      }

      const dynamicRoutes = _this.extractDynamicRoutes(routesPath);
      let matchCount = 0;

      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const dynamicRoute = dynamicRoutes[i];
        const match = dynamicRoute.paramFinderExpression.exec(path);

        if (!match) {
          continue;
        }

        matchCount++;

        const params = _this.createParamValueMap(dynamicRoute.paramNames, match.slice(1));
        // Create a unique id for the combination of the route and its parameters
        const resolveId = dynamicRoute.id + ' ' + JSON.stringify(params);

        if (_this.oldResolveId !== resolveId) {
          _this.oldResolveId = resolveId;

          const routeIndex = routesPath.indexOf(dynamicRoute.id);
          const pp = dynamicRoute.id.split('/').filter(t => t.indexOf(':') !== 0).join('/');
          const parts = hash.replace(pp, '').split('/');
          // const parts = hash.split('/').slice(2);

          _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);
          break;
        }
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (route, hash, params, parentParams) {
      if (typeof route.handle === 'function') {
        this.data.activeModule = route.handle.call(null, params, parentParams);
      } else {
        this.data.activeModule = route.module;
      }
      this.data.activeRoute = hash;
      this.data.activeLink = route;
      // if (route.act instanceof Function) {
      //   route.act.call(null, params, parentParams);
      // } else if (route.act instanceof Object) {
      //   const routes = this.parseRoutes(route.act);
      //   if (route.act._canActivate instanceof Function) {
      //     if (!route.act._canActivate.call(null, params, parentParams)) {
      //       return;
      //     }
      //   }
      //
      //   this.callMatchRoute(routes, hash, params);
      // }
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
debugger
      if (hash.indexOf(this.root) === 0) {
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

        scope.data.router = router.data;

        return router;
      },
      start: function () { }
    };
  });

  G.Router = SimpleRouter;

})(Galaxy);
