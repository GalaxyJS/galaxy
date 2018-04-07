/* global Galaxy */

Galaxy.View.PROPERTY_SETTERS.custom = function (viewNode, attrName, property, expression) {
  const setter = Galaxy.View.createCustomSetter(viewNode, attrName, property);

  // return function (value, oldValue, scopeData) {
  //   if (value instanceof Promise) {
  //     const asyncCall = function (asyncValue) {
  //       property.handler(node, attributeName, asyncValue, oldValue, scopeData);
  //     };
  //     value.then(asyncCall).catch(asyncCall);
  //   } else {
  //     property.handler(node, attributeName, value, oldValue, scopeData);
  //   }
  // };

  if (expression) {
    return function (none, oldValue) {
      const expressionValue = expression(none);
      setter(expressionValue, oldValue);
    };
  }

  return setter;
};
