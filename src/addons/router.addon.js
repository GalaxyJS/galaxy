/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/router', function (scope, module) {
  return {
    create: function () {
      const router = new Galaxy.Router(scope, module);
      if (module.systemId !== 'root') {
        scope.on('module.destroy', () => router.destroy());
      }

      scope.router = router.data;

      return router;
    },
    start: function () { }
  };
});
