/* global Galaxy */

Galaxy.View.PROPERTY_SETTERS.attr = function (viewNode, attrName, property, expression) {
  const valueFn = property.value || Galaxy.View.setAttr;
  const setter = function (value, oldValue) {
    if (value instanceof Promise) {
      const asyncCall = function (asyncValue) {
        valueFn(viewNode, asyncValue, oldValue, attrName);
      };
      value.then(asyncCall).catch(asyncCall);
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
