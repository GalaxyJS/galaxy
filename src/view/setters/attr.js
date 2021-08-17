/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.attr = function (viewNode, attrName, property, expression) {
    const valueFn = property.value || G.View.setAttr;
    const setter = function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          valueFn(viewNode, asyncValue, oldValue, attrName);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        valueFn(viewNode, result, value.oldResult, attrName);
        value.oldResult = value;
      } else {
        valueFn(viewNode, value, oldValue, attrName);
      }
    };

    if (expression) {
      return function (none, oldValue) {
        const expressionValue = expression(none);
        setter(expressionValue, oldValue);
      };
    }

    return setter;
  };
})(Galaxy);
