/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['_if'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['_if'] = {
    type: 'reactive',
    key: '_if',
    getConfig: function () {
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
     * @param expression
     */
    update: function (config, value, expression) {
      const viewNode = this;
      if (expression) {
        value = expression();
      }

      if (!viewNode.rendered.resolved && !value) {
        viewNode.blueprint.renderConfig.renderDetached = true;
      }

      viewNode.rendered.then(() => {
        if (viewNode.inDOM !== value) {
          viewNode.setInDOM(value);
        }
      });
    }
  };

})(Galaxy);

