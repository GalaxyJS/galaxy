/* global Galaxy */

Galaxy.GalaxyView.PROPERTY_SETTERS.custom = function (viewNode, attrName, property, expression) {
  const setter = Galaxy.GalaxyView.createCustomSetter(viewNode, attrName, property);

  if (expression) {
    return function (none, oldValue, scopeData) {
      const expressionValue = expression(none);
      setter(expressionValue, oldValue, scopeData);
    };
  }

  return setter;
};
