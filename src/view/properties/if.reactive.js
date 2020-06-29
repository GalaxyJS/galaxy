/* global Galaxy */

(function (Galaxy) {
  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  Galaxy.View.REACTIVE_BEHAVIORS['$if'] = {
    prepare: function () {
      return {
        leaveProcessList: [],
        queue: [],
        mainPromise: null,
        onDone: function () {
        }
      };
    },
    install: function (config) {
      const parentNode = this.parent;
      parentNode.cache.$if = parentNode.cache.$if || { leaveProcessList: [], queue: [], mainPromise: null };
    },
    apply: function (config, value, oldValue, expression) {
      /** @type {Galaxy.View.ViewNode} */
      const node = this;

      if (expression) {
        value = expression();
      }

      node.rendered.then(() => {
        node.setInDOM(value);
      });
    }
  };
})(Galaxy);

