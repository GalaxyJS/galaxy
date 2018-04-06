/* global Galaxy */
'use strict';

(function (G) {
  G.registerAddOnProvider('galaxy/view', function (scope) {
    return {
      /**
       *
       * @return {Galaxy.GalaxyView}
       */
      create: function () {
        return new Galaxy.GalaxyView(scope);
      },
      finalize: function () {
      }
    };
  });
})(Galaxy);
