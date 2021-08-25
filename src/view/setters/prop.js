/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.prop = function (viewNode, attrName, property, expression) {
    if (!property.name) {
      console.error(property);
      throw new Error('PROPERTY_SETTERS.prop: property.name is mandatory in order to create property setter');
    }

    const valueFn = property.value || G.View.setProp;
    const setter = function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          valueFn(viewNode, asyncValue, oldValue, property.name);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        valueFn(viewNode, result, oldValue, property.name);
        value.oldResult = value;
      } else {
        valueFn(viewNode, value, oldValue, property.name);
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
