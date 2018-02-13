/* global Galaxy */
'use strict';

(function (G) {
  G.registerAddOnProvider('galaxy/view', function (scope) {
    return {
      create: function () {
        let view = new Galaxy.GalaxyView(scope);

        return view;
      },
      finalize: function () {

      }
    };
  });
})(Galaxy);