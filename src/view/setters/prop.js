/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.prop = function (viewNode, property, expression) {
    const propName = property.key;
    if (!propName) {
      console.error(property);
      throw new Error('PROPERTY_SETTERS.prop: property.name is mandatory in order to create property setter');
    }

    const updateFn = property.update || G.View.setProp;
    const setter = function P(value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          updateFn(viewNode, asyncValue, oldValue, propName);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        updateFn(viewNode, result, oldValue, propName);
        value.oldResult = value;
      } else {
        updateFn(viewNode, value, oldValue, propName);
      }
    };

    if (expression) {
      return function () {
        const expressionValue = expression();
        setter(expressionValue);
      };
    }

    return setter;
  };
})(Galaxy);
