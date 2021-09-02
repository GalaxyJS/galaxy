/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.attr = function (viewNode, property, expression) {
    const attrName = property.key;
    const updateFn = property.update || G.View.setAttr;
    const setter = function A(value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          updateFn(viewNode, asyncValue, oldValue, attrName);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        updateFn(viewNode, result, value.oldResult, attrName);
        value.oldResult = value;
      } else {
        updateFn(viewNode, value, oldValue, attrName);
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
