/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/router', {
  provideInstance: function (scope, module) {
    const router = new Galaxy.Router(scope, module);
    if (module.systemId !== '@root') {
      scope.on('module.destroy', () => router.destroy());
    }

    scope.router = router.data;

    return router;
  },
  startInstance: function (instance) {

  }
});
