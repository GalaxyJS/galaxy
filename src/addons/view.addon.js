/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/view', function (scope) {
  return {
    /**
     *
     * @return {Galaxy.View}
     */
    create: function () {
      return new Galaxy.View(scope);
    },
    start: function () {
    }
  };
});
