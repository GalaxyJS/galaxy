(function (G) {
  'use strict';

  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  // SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  // SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  // SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  // SimpleRouter.MATCH_REGEXP_FLAGS = '';

  function SimpleRouter(module) {
    this.module = module;
    this.root = module.id === 'system' ? '#' : module.systemId.replace('system/', '#/');
    this.oldURL = null;
    this.oldResolveId = null;
    this.routes = null;
  }

  SimpleRouter.prototype = {
    init: function (routes) {
      this.routes = routes;
      this.listener = this.detect.bind(this);
      window.addEventListener('hashchange', this.listener);
      this.detect();
    },

    navigate: function (path) {
      path = path.replace(/^#\//, '/');
      if (path.indexOf('/') !== 0) {
        path = '/' + path;
      }

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

    callMatchRoute: function (hash) {
      const _this = this;
      const path = _this.normalizeHash(hash);
      const routesPath = Object.keys(_this.routes);

      // Hard match
      if (routesPath.indexOf(path) !== -1) {
        // debugger;
        _this.oldResolveId = path;
        return _this.routes[path].call(null);
      }

      const dynamicRoutes = _this.extractDynamicRoutes(routesPath);
      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const dynamicRoute = dynamicRoutes[i];
        const match = dynamicRoute.paramFinderExpression.exec(path);

        if (!match) {
          continue;
        }

        const params = _this.createParamValueMap(dynamicRoute.paramNames, match.slice(1));
        // Create a unique id for the combination of the route and its parameters
        const resolveId = dynamicRoute.id + ' ' + JSON.stringify(params);

        if (_this.oldResolveId !== resolveId) {
          _this.oldResolveId = resolveId;
          // debugger;
          return _this.routes[dynamicRoute.id].call(null, params);
        }
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
            paramFinderExpression: new RegExp(route.replace(SimpleRouter.PARAMETER_REGEXP, SimpleRouter.REPLACE_VARIABLE_REGEXP), 'g')
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
          this.callMatchRoute(hash);
        }
      }
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
