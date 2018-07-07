(function (G) {
  'use strict';

  SimpleRouter.PARAMETER_REGEXP = /([:*])(\w+)/g;
  SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  SimpleRouter.MATCH_REGEXP_FLAGS = '';

  function SimpleRouter(module) {
    console.info(module);
    this.module = module;
    this.root = module.id === 'system' ? '#' : module.systemId.replace('system/', '#/');
    this.oldURL = null;
    this.routes = null;

    this.detect();
  }

  SimpleRouter.prototype = {
    init: function (routes) {
      this.routes = routes;
      window.addEventListener('hashchange', this.detect.bind(this));
    },
    navigate: function (path) {
      window.location.hash = path;
    },
    notFound: function () {

    },
    detect: function () {
      const hash = window.location.hash;
      debugger;
      if (hash.indexOf(this.root) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          console.info(this);
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
