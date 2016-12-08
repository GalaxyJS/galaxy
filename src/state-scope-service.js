/* global Galaxy */

(function (galaxy) {
  galaxy.registerScopeService('state', function (scope) {
    var module = galaxy.createState(scope.stateId);
    return {
      pre: function () {
        return module;
      },
      post: function () {
        var modulePath = module.domain.app.navigation[module.stateKey] ? module.domain.app.navigation[module.stateKey] : [];
        var moduleNavigation = Galaxy.utility.extend(true, {}, module.domain.app.navigation);
        moduleNavigation[module.stateKey] = modulePath.slice(module.id.split('/').length - 1);

        module.init(moduleNavigation, module.domain.app.params);
      }
    };
  });
})(Galaxy);