/* global Galaxy */

Galaxy.GalaxyView.PROPERTY_SETTERS.prop = function (viewNode,attrName, property, expression) {
  const setter = Galaxy.GalaxyView.createPropertySetter(viewNode, property);

  if (expression) {
    return function (none, oldValue) {
      let expressionValue = expression(none);
      setter(expressionValue, oldValue);
    };
  }

  return setter;
};
