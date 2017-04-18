/* global Galaxy */

(function (galaxy) {
  galaxy.registerScopeService('galaxy/scope-state', function (scope, module) {
    module.domain = module.domain || Galaxy;
    // if (!domain) {
    //   throw 'Domain can NOT be null';
    // }
    //
    // if (domain.modules[ module.systemId ]) {
    //   return domain.modules[  module.systemId ];
    // }

    var stateModule = module.services[ 'galaxy/scope-state' ] || new Galaxy.GalaxyStateHandler(module);
    // var stateModule = galaxy.createState(scope.systemId);
    // stateModule.scope = scope;
    // debugger;
    // module.services['galaxy/scope-state'] = stateModule;
    // debugger;
    // var stateModule;
    // var domain = Galaxy;
    // if (!domain) {
    //   throw 'Domain can NOT be null';
    // }
    // var id = scope.systemId;
    // if (domain.modules[ id ]) {
    //   return domain.modules[ id ];
    // }
    //
    // stateModule = new Galaxy.GalaxyModule();
    // stateModule.domain = domain;
    // stateModule.systemId = id;
    // stateModule.id = id.replace('system/', '');
    //
    // module.services[ 'galaxy/scope-state' ] = stateModule;

    return {
      pre: function () {
        return stateModule;
      },
      post: function () {
        var modulePath = stateModule.domain.app.navigation[ stateModule.stateKey ] ?
          stateModule.domain.app.navigation[ stateModule.stateKey ] :
          [];
        var moduleNavigation = Galaxy.utility.extend(true, {}, stateModule.domain.app.navigation);
        moduleNavigation[ stateModule.stateKey ] = modulePath.slice(stateModule.id.split('/').length - 1);

        stateModule.init();
      }
    };
  });
})(Galaxy);
