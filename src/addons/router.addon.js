(function (G) {
  'use strict';

  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  // SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  // SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  // SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  // SimpleRouter.MATCH_REGEXP_FLAGS = '';

  function SimpleRouter(module) {
    const _this = this;
    this.module = module;
    this.root = module.id === 'system' ? '#' : module.systemId.replace('system/', '#/');
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

      const routePaths = Object.keys(routes);
      for (let i = 0, len = routePaths.length; i < len; i++) {
        if (routePaths[i].indexOf('/') !== 0) {
          throw new Error('The route `' + routePaths[i] + '` is not valid because it does not begin with `/`.\n' +
            'Please change it to `/' + routePaths[i] + '` and make sure that all of your routes start with `/`.\n');
        }

        this.routes.push({
          path: routePaths[i],
          act: routes[routePaths[i]]
        });
      }

      this.listener = this.detect.bind(this);
      window.addEventListener('hashchange', this.listener);
      this.detect();
    },

    navigate: function (path) {
      path = path.replace(/^#\//, '/');
      if (path.indexOf('/') !== 0) {
        path = '/' + path;
      }

      this.dirty = true;
      window.location.hash = path;
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
      const _this = this;

      if (hash.indexOf('#!/') === 0) {
        throw new Error('Please use `#/` instead of `#!/` for you hash');
      }

      let normalizedHash = hash;
      if (hash.indexOf('#/') !== 0) {
        if (hash.indexOf('/') === 0) {
          normalizedHash = '/' + hash;
        } else if (hash.indexOf('#') === 0) {
          normalizedHash = hash.split('#').join('#/');
        }
      }

      return normalizedHash.replace(_this.root, '') || '/';
    },

    callMatchRoute: function (routes, hash) {
      const _this = this;
      const path = _this.normalizeHash(hash);
      const routesPath = routes.map(function (item) {
        return item.path;
      });
      debugger;

      // Hard match
      const routeIndex = routesPath.indexOf(path);
      if (routeIndex !== -1) {
        // delete all old resolved ids
        _this.oldResolveId = {};
        return routes[routeIndex].call(null);
      }

      const dynamicRoutes = _this.extractDynamicRoutes(routesPath);
      let depth = 0;
      let parentRoute;
      let matchCount = 0;
      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const dynamicRoute = dynamicRoutes[i];
        const match = dynamicRoute.paramFinderExpression.exec(path);

        if (!match) {
          continue;
        }

        matchCount++;

        if (parentRoute) {
          const match = parentRoute.paramFinderExpression.exec(path);

          if (!match || depth >= path.split('/').length) {
            continue;
          }
        }

        if (_this.dirty) {
          Object.keys(_this.routes);

          this.dirty = false;
          this.callMatchRoute(routes, window.location.hash);
          break;
        }

        const params = _this.createParamValueMap(dynamicRoute.paramNames, match.slice(1));
        // Create a unique id for the combination of the route and its parameters
        const resolveId = dynamicRoute.id + ' ' + JSON.stringify(params);
        if (_this.oldResolveId[dynamicRoute.id] !== resolveId) {
          _this.oldResolveId = {};
          _this.oldResolveId[dynamicRoute.id] = resolveId;
          // _this.callRoute(routes[dynamicRoute.id], params);

          _this.routesMap[dynamicRoute.id].call(null, params);
          parentRoute = dynamicRoute;
          depth = dynamicRoute.id.split('/').length;
        }
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found');
      }
    },

    callRoute: function (route, params) {
      if (route instanceof Object) {
      } else {
        route.call(null, params);
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
      const hash = window.location.hash || '#/';

      if (hash.indexOf(this.root) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          this.callMatchRoute(this.routes, hash);
        }
      }
    },

    getURLParts: function () {
      return this.oldURL.split('/').slice(1);
    },

    destroy: function () {
      window.removeEventListener('hashchange', this.listener);
    }
  };

  G.registerAddOnProvider('galaxy/router', function (scope, module) {
    return {
      create: function () {
        if (module.systemId === 'system') {
          return new SimpleRouter(module);
        } else {
          const router = new SimpleRouter(module);
          scope.on('module.destroy', function () {
            router.destroy();
          });

          return router;
        }
      },
      finalize: function () { }
    };
  });

})(Galaxy);
