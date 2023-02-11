/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/view', {
  /**
   *
   * @return {Galaxy.View}
   */
  provideInstance: function (scope, module) {
    return new Galaxy.View(scope);
  },
  startInstance: function (instance, module) {

  }

});
