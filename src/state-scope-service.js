/* global Galaxy */

(function (galaxy) {
  var addOnId = 'galaxy/scope-state';
  galaxy.registerAddOnProvider(addOnId, function (scope, module) {
    var stateModule = module.addOns[ addOnId ] || new Galaxy.GalaxyStateHandler(module);

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
