/* global Galaxy */

(function (G) {
  G.registerAddOnProvider('galaxy/view', function (scope) {
    return {
      create: function () {
        var view = new Galaxy.GalaxyView(scope);

        return view;
      },
      finalize: function () {

      }
    };
  });
})(Galaxy);
