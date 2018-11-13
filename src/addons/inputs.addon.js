/* global Galaxy */
'use strict';

(function (G) {
  G.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      /**
       *
       * @return {*}
       */
      create: function () {
        return scope.inputs;
      },
      finalize: function () { }
    };
  });
})(Galaxy);
