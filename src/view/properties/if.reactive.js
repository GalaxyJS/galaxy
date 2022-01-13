/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['if'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['if'] = {
    type: 'reactive',
    key: 'if',
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

      value = Boolean(value);

      if (!viewNode.rendered.resolved && !value) {
        viewNode.blueprint.renderConfig.renderDetached = true;
      }

      // if(viewNode.rendered.resolved) {
      //   if (viewNode.inDOM !== value) {
      //     viewNode.setInDOM(value);
      //   }
      // } else {
      viewNode.rendered.then(() => {
        viewNode.node.setAttribute('data-if', value);
        if (viewNode.inDOM !== value) {
          viewNode.setInDOM(value);
        }
      });
      // }
    }
  };

})(Galaxy);

