/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['$if'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if',
    prepare: function () {
      return {
        throttleId: null,
      };
    },
    install: function (config) {
      return true;
    },
    /**
     *
     * @this Galaxy.View.ViewNode
     * @param config
     * @param value
     * @param oldValue
     * @param expression
     */
    apply: function (config, value, oldValue, expression) {
      if (config.throttleId) {
        window.cancelAnimationFrame(config.throttleId);
        config.throttleId = 0;
      }

      const viewNode = this;
      if (expression) {
        value = expression();
      }

      if (!viewNode.rendered.resolved && !value) {
        viewNode.blueprint.renderConfig.renderDetached = true;
      }

      config.throttleId = window.requestAnimationFrame(() => {
        viewNode.rendered.then(() => {
          if (viewNode.inDOM !== value) {
            viewNode.setInDOM(value);
          }
        });
      });
    }
  };

})(Galaxy);

