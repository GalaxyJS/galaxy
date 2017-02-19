/* global Galaxy */

(function () {
  Galaxy.GalaxyHelpers = Helpers;
  Galaxy.helpers = new Galaxy.GalaxyHelpers();

  function Helpers() {
  }

  Helpers.prototype.loadModuleInto = function (module, element) {
    Galaxy.load(module, function (module) {
      Galaxy.ui.setContent(element, module.scope.html);

      if (module.start) {
        module.start();
      }
    });
  };
})();