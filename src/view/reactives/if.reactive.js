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
    if (value && !node.inDOM && !node.node.parentNode) {
      node.setInDOM(true);
    } else if (!value && node.inDOM && node.node.parentNode) {
      cancelAnimationFrame(node.cache._ifLeaveId);
      node.cache._ifLeaveId = requestAnimationFrame(function () {
        node.setInDOM(false);
      });
    } else {
    }
  }
})(Galaxy.View);

