/* global Galaxy */

Galaxy.GalaxyView.PROPERTY_SETTERS.attr = function (viewNode, attrName, property, expression) {
  let parser = property.parser;
  const setter = Galaxy.GalaxyView.createDefaultSetter(viewNode, attrName, parser);
  if (expression) {
    return function (none, oldValue) {
      let expressionValue = expression(none);
      setter(expressionValue, oldValue);
    };
  }

  return setter;
};
