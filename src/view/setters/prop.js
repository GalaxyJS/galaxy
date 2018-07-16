/* global Galaxy */

Galaxy.View.PROPERTY_SETTERS.prop = function (viewNode, attrName, property, expression) {
  if (!property.name) {
    console.error(property);
    throw new Error('PROPERTY_SETTERS.prop: property.name is mandatory in order to create property setter');
  }

  const valueFn = property.value || function (vn, an, v, ov) {
    vn.node[an] = v;
  };

  const setter = function (value, oldValue) {
    if (value instanceof Promise) {
      const asyncCall = function (asyncValue) {
        valueFn(viewNode, property.name, asyncValue, oldValue);
        viewNode.notifyObserver(property.name, value, oldValue);
      };
      value.then(asyncCall).catch(asyncCall);
    } else {
      valueFn(viewNode, property.name, value, oldValue);
      viewNode.notifyObserver(property.name, value, oldValue);
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
