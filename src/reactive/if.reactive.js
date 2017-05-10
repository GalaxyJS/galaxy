/* global Galaxy */

(function () {

  Galaxy.GalaxyView.REACTIVE_BEHAVIORS[ 'if' ] = {
    regex: null,
    bind: function (galaxyView, nodeScopeData, matches) {
      this.makeBinding(galaxyView.node, nodeScopeData, 'reactive_if', matches);
    },
    onApply: function (galaxyView, value) {
      if (value) {
        galaxyView.setInDOM(true);
      } else {
        galaxyView.setInDOM(false);
      }
    }
  };
})();

