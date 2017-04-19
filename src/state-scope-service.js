/* global Galaxy */

(function (galaxy) {
  galaxy.registerScopeService('galaxy/scope-state', function (scope, module) {
    module.domain = module.domain || Galaxy;
    var stateModule = module.addOns[ 'galaxy/scope-state' ] || new Galaxy.GalaxyStateHandler(module);

    return {
      pre: function () {
        return stateModule;
      },
      post: function () {
        stateModule.init();
      }
    };
  });
})(Galaxy);
