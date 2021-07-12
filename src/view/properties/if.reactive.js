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
      const _this = this;
      if (expression) {
        value = expression();
      }

      config.throttleId = window.requestAnimationFrame(() => {
        _this.rendered.then(() => {
          if (_this.inDOM !== value) {
            _this.setInDOM(value);
          }
        });
      });
    }
  };
})(Galaxy);

