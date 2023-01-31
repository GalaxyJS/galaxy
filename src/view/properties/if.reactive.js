/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['if'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['if'] = {
    type: 'reactive',
    key: 'if',
    getConfig: function () {
      return {
        throttleId: 0,
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
      if (config.throttleId !== 0) {
        window.clearTimeout(config.throttleId);
        config.throttleId = 0;
      }

      if (expression) {
        value = expression();
      }

      value = Boolean(value);

      if (!this.rendered.resolved && !this.inDOM && !value) {
        this.blueprint.renderConfig.renderDetached = true;
      }

      // setTimeout is called before requestAnimationTimeFrame
      config.throttleId = setTimeout(() => {
        this.rendered.then(() => {
          // this.node.setAttribute('data-if', value);
          if (this.inDOM !== value) {
            this.setInDOM(value);
          }
        });
      });
    }
  };

})(Galaxy);

