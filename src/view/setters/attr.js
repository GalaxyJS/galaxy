/* global Galaxy */

Galaxy.GalaxyView.PROPERTY_SETTERS.attr = function (viewNode, attrName, property, expression) {
  let parser = property.parser;
  const setter = Galaxy.GalaxyView.createDefaultSetter(viewNode, attrName, parser);

  // function (value, oldValue) {
  //   if (value instanceof Promise) {
  //     const asyncCall = function (asyncValue) {
  //       const newValue = parser ? parser(asyncValue) : asyncValue;
  //       GalaxyView.setAttr(node, attributeName, newValue, oldValue);
  //     };
  //     value.then(asyncCall).catch(asyncCall);
  //   } else {
  //     const newValue = parser ? parser(value) : value;
  //     GalaxyView.setAttr(node, attributeName, newValue, oldValue);
  //   }
  // };

  if (expression) {
    return function (none, oldValue) {
      let expressionValue = expression(none);
      setter(expressionValue, oldValue);
    };
  }

  return setter;
};
