(function (G) {
  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  // SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  // SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  // SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  // SimpleRouter.MATCH_REGEXP_FLAGS = '';

  function SimpleRouter(module) {
    const _this = this;
    this.config = {
      baseURL: '/'
    };
    this.module = module;
    this.root = module.id === 'system' ? '/' : module.systemId.replace('system/', '/');
    this.oldURL = '';
    this.oldResolveId = {};
    this.routes = [];
    this.routesMap = null;
    this.dirty = false;

    Object.defineProperty(this, 'urlParts', {
      get: function () {
        return _this.oldURL.split('/').slice(1);
      },
      enumerable: true
    });
  }

  SimpleRouter.prototype = {
    init: function (routes) {
      this.routesMap = routes;
      this.routes = this.parseRoutes(routes);

      this.listener = this.detect.bind(this);
      window.addEventListener('popstate', this.listener);
      // window.addEventListener('hashchange', this.listener);

      this.detect();
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
      path = this.config.baseURL + path.replace(/^#\//, '/');
      if (path.indexOf('/') !== 0) {
        path = '/' + path;
      }

      history.pushState({}, '', path);
      this.detect();
    },

    navigateFromHere: function (path) {
      if (path.indexOf('/') !== 0) {
        path = '/' + path;
      }

      this.navigate(this.root + path);
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

      return normalizedHash.replace(this.config.baseURL, '/').replace(this.root, '/') || '/';
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
        // delete all old resolved ids
        _this.oldResolveId = {};
        return routes[routeIndex].act.call(null, {}, parentParams);
      }

      const dynamicRoutes = _this.extractDynamicRoutes(routesPath);
      let matchCount = 0;
      // debugger;
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
        if (_this.oldResolveId[dynamicRoute.id] !== resolveId) {
          _this.oldResolveId = {};
          _this.oldResolveId[dynamicRoute.id] = resolveId;

          const routeIndex = routesPath.indexOf(dynamicRoute.id);
          const parts = hash.split('/').slice(2);

          _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);
          break;
        }
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found');
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
      // debugger
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

        return router;
      },
      start: function () { }
    };
  });

})(Galaxy);
