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

  function SimpleRouter(module) {
    const _this = this;
    _this.config = {
      baseURL: '/'
    };
    _this.module = module;
    _this.root = module.id === 'system' ? '/' : module.systemId.replace('system/', '/');
    _this.oldURL = '';
    _this.oldResolveId = null;
    _this.routes = [];
    _this.routesMap = null;
    _this.data = {
      activeRoute: null,
      activeRouteModule: null
    };
    _this.viewport = {
      tag: 'main',
      module: '<>data.state.activeRouteModule'
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
      this.routesMap = routes;
      this.routes = this.parseRoutes(routes);

      this.listener = this.detect.bind(this);

      window.addEventListener('popstate', this.listener);

      this.detect();
    },

    assign: function (routes, overrides) {
      this.init(Object.assign({}, routes, overrides));
    },

    parseRoutes: function (routesMap) {
      const routes = [];

      const routePaths = Object.keys(routesMap);

      for (let i = 0, len = routePaths.length; i < len; i++) {
        if (routePaths[i].indexOf('/') !== 0 && routePaths[i].indexOf('_') !== 0) {
          throw new Error('The route `' + routePaths[i] + '` is not valid because it does not begin with `/`.\n' +
            'Please change it to `/' + routePaths[i] + '` and make sure that all of your routes start with `/`.\n');
        }

        routes.push({
          path: routePaths[i],
          act: routesMap[routePaths[i]]
        });
      }

      return routes;
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
        return item.path;
      });

      // Hard match
      const routeIndex = routesPath.indexOf(path);
      if (routeIndex !== -1) {
        const act = routes[routeIndex].act;
        // delete all old resolved ids
        if (typeof act === 'string') {
          return this.navigateFromHere(act);
        }

        _this.oldResolveId = null;
        return act.call(null, {}, parentParams);
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
          const parts = hash.split('/').slice(2);

          _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);
          _this.data.activeRouteModule = routes[routeIndex];
          _this.data.activeRoute = hash;
          break;
        }
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (route, hash, params, parentParams) {
      if (route.act instanceof Function) {
        route.act.call(null, params, parentParams);
      } else if (route.act instanceof Object) {
        const routes = this.parseRoutes(route.act);
        if (route.act._canActivate instanceof Function) {
          if (!route.act._canActivate.call(null, params, parentParams)) {
            return;
          }
        }

        this.callMatchRoute(routes, hash, params);
      }
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
        const router = new SimpleRouter(module);
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
