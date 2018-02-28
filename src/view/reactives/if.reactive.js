/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    install: function (data) {
    },
    apply: function (data, value, oldValue, expression, scope) {
      if (expression) {
        value = expression();
      }

      createProcess(this, value);
    }
  };

  function createProcess(node, value) {
    node.rendered.then(function () {
      node.renderingFlow.truncate();
      node.renderingFlow.next(function ifProcess(next) {
        if (value && !node.inDOM) {
          // debugger;
          node.setInDOM(true);
          node.sequences.enter.next(function () {
            next();
          });
        } else if (!value && node.inDOM) {
          // debugger;
          node.setInDOM(false);
          node.sequences.leave.next(next);
        } else {
          next();
        }
      });
    });
  }
})(Galaxy.GalaxyView);

