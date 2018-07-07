(function (G) {
  'use strict';

  SimpleRouter.PARAMETER_REGEXP = new RegExp(/[:*](\w+)/g);
  SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  SimpleRouter.MATCH_REGEXP_FLAGS = '';

  function SimpleRouter(module) {
    console.info(module);
    this.module = module;
    this.root = module.id === 'system' ? '#' : module.systemId.replace('system/', '#');
    this.oldURL = null;
    this.oldResolveId = null;
    this.routes = null;
  }

  SimpleRouter.prototype = {
    init: function (routes) {
      this.routes = routes;
      window.addEventListener('hashchange', this.detect.bind(this));
      this.detect();
    },
    navigate: function (path) {
      window.location.hash = path;
    },
    notFound: function () {

    },
    callMatchRoute: function (hash) {
      const _this = this;
      const path = hash.replace(/^\#/, '/');
      const routesPath = Object.keys(_this.routes);

      // Hard match
      if (routesPath.indexOf(path) !== -1) {
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
        const resolveId = dynamicRoute.id + ' ' + JSON.stringify(params);

        if (_this.oldResolveId !== resolveId) {
          _this.oldResolveId = resolveId;
          debugger
          return _this.routes[dynamicRoute.id].call(null, params);
        }
      }
    },

    extractDynamicRoutes: function (routesPath) {
      return routesPath.map(function (route) {
        const params = [];
        let match = SimpleRouter.PARAMETER_REGEXP.exec(route);
        while (match) {
          params.push(match[1]);
          match = SimpleRouter.PARAMETER_REGEXP.exec(route);
        }

        if (params.length) {
          return {
            id: route,
            paramNames: params,
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
      const hash = window.location.hash || '#';
debugger;
      if (hash.indexOf(this.root) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          this.callMatchRoute(hash);
        }

      }
    }
  };

  G.registerAddOnProvider('galaxy/router', function (scope, module) {
    return {
      create: function () {
        if (module.systemId === 'system') {
          const router = new SimpleRouter(module);
          return router;
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
