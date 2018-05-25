/* global Galaxy */

Galaxy.View.PROPERTY_SETTERS.prop = function (viewNode, attrName, property, expression) {
  const setter = Galaxy.View.createPropertySetter(viewNode, property);

  if (expression) {
    return function (none, oldValue) {
      let expressionValue = expression(none);
      setter(expressionValue, oldValue);
    };
  }

  return setter;
};
