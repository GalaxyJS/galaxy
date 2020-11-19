/* global Galaxy */
(function (G) {
  G.View.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
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
    },
    apply: function (config, value, oldValue, expression) {
      /** @type {Galaxy.View.ViewNode} */
      const node = this;

      // if (config.throttleId) {
      //   window.cancelAnimationFrame(config.throttleId);
      // }

      if (expression) {
        value = expression();
      }

      /*config.throttleId = */
      window.requestAnimationFrame(() => {
        node.rendered.then(() => {
          if (node.inDOM !== value) {
            node.setInDOM(value);
          }
        });
      });
    }
  };
})(Galaxy);

