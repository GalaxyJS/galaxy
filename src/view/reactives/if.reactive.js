/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    prepareData: function () { },
    install: function (data) { },
    apply: function (data, value, oldValue, expression) {
      const _this = this;
      if (expression) {
        value = expression();
      }
      runIfProcess(_this, value);
    }
  };

  function runIfProcess(node, value) {
    // debugger
    // node.rendered.then(function () {
    // node.renderingFlow.truncate();
    // node.renderingFlow.next(function ifProcess(next) {
    if (value && !node.inDOM) {
      node.setInDOM(true);
      // node.sequences.enter.next(function () {
      //   next();
      // });
    } else if (!value && node.inDOM) {
      node.setInDOM(false);
      // node.sequences.leave.next(next);
    } else {
      // next();
    }
    // });
    // });
  }
})(Galaxy.GalaxyView);

