/* global Galaxy */
'use strict';

(function (G) {
  G.registerAddOnProvider('galaxy/view', function (scope) {
    return {
      /**
       *
       * @return {Galaxy.View}
       */
      create: function () {
        return new Galaxy.View(scope);
      },
      finalize: function () {
      }
    };
  });
})(Galaxy);
