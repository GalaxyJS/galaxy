/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['visible'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['visible'] = {
    type: 'reactive',
    key: 'visible',
    getConfig: function () {
      return {
        throttleId: null,
      };
    },
    install: function () {
      return true;
    },
    update: function (config, value, expression) {
      if (config.throttleId) {
        window.cancelAnimationFrame(config.throttleId);
        config.throttleId = 0;
      }
      /** @type {Galaxy.View.ViewNode} */
      const _this = this;
      if (expression) {
        value = expression();
      }

      config.throttleId = window.requestAnimationFrame(() => {
        _this.rendered.then(() => {
          if (_this.visible !== value) {
            _this.setVisibility(value);
          }
        });
      });
    }
  };
})(Galaxy);

