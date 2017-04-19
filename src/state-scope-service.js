/* global Galaxy */

(function (galaxy) {
  galaxy.registerScopeService('galaxy/scope-state', function (scope, module) {
    module.domain = module.domain || Galaxy;
    var stateModule = module.services[ 'galaxy/scope-state' ] || new Galaxy.GalaxyStateHandler(module);

    return {
      pre: function () {
        return stateModule;
      },
      post: function () {
        // var modulePath = stateModule.domain.app.navigation[ stateModule.stateKey ] ?
        //   stateModule.domain.app.navigation[ stateModule.stateKey ] :
        //   [];
        // var moduleNavigation = Galaxy.utility.extend(true, {}, stateModule.domain.app.navigation);
        // moduleNavigation[ stateModule.stateKey ] = modulePath.slice(stateModule.id.split('/').length - 1);

        stateModule.init();
      }
    };
  });
})(Galaxy);
