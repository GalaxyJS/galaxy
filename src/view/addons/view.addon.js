/* global Galaxy */

(function (G) {
  G.registerAddOnProvider('galaxy/view', function (scope, module) {
    return {
      pre: function () {
        // Create viewNode
        var view = new Galaxy.GalaxyView.ViewNode(null, {
          tag: 'div',
          sid: scope.systemId
        });

        return view;
      },
      post: function () {

      }
    };
  });
})(Galaxy);
