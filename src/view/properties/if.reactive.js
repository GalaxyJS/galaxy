/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  G.View.REACTIVE_BEHAVIORS['$if'] = {
    prepare: function () {
      return {
        throttleId: null,
      };
    },
    install: function (config) {
      return true;
    },
    apply: function (config, value, oldValue, expression) {
      if (config.throttleId) {
        window.cancelAnimationFrame(config.throttleId);
        config.throttleId = 0;
      }
      /** @type {Galaxy.View.ViewNode} */
      const viewNode = this;
      if (expression) {
        value = expression();
      }

      let pes = null;
      if (!viewNode.rendered.resolved && !value) {
        // pes = viewNode.populateLeaveSequence;
        // viewNode.populateLeaveSequence = (r) => {
        // debugger;
        // r();
        // };
      }

      config.throttleId = window.requestAnimationFrame(() => {
        viewNode.rendered.then(() => {
          if (viewNode.inDOM !== value) {
            viewNode.setInDOM(value);
          }

          if (pes) {
            // viewNode.populateLeaveSequence = pes;
            // pes = null;
          }
        });
      });
    }
  };
})(Galaxy);

