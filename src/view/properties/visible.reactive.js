/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['visible'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['visible'] = {
    type: 'reactive',
    key: 'visible',
    getConfig: function () {
      return {
        throttleId: 0,
      };
    },
    install: function () {
      return true;
    },
    update: function (config, value, expression) {
      if (config.throttleId !== 0) {
        window.clearTimeout(config.throttleId);
        config.throttleId = 0;
      }
      /** @type {Galaxy.View.ViewNode} */
      if (expression) {
        value = expression();
      }

      // setTimeout is called before requestAnimationTimeFrame
      config.throttleId = window.setTimeout(() => {
        this.rendered.then(() => {
          if (this.visible !== value) {
            this.setVisibility(value);
          }
        });
      });
    }
  };
})(Galaxy);

