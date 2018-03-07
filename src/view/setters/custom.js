/* global Galaxy */

Galaxy.GalaxyView.PROPERTY_SETTERS.custom = function (viewNode, attrName, property, expression) {
  const setter = Galaxy.GalaxyView.createCustomSetter(viewNode, attrName, property);

  if (expression) {
    return function (none, oldValue, scopeData) {
      console.info('none->', none, oldValue, scopeData);
      // if (scopeData && scopeData.hasOwnProperty('personOne')) {
      //   let asd = expression(none);
      //   viewNode
      //
      // }
      // debugger;
      let expressionValue = expression(none);
      setter(expressionValue, oldValue, scopeData);
    };
  }

  return setter;
};
