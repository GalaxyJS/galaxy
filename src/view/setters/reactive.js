/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.reactive = function (viewNode, attrName, property, expression, scope) {
    const behavior = G.View.REACTIVE_BEHAVIORS[property.name];
    const cache = viewNode.cache[attrName];

    return createReactiveFunction(behavior, viewNode, cache, expression, scope);
  };

  function createReactiveFunction(behavior, vn, data, expression, scope) {
    return function R(value, oldValue) {
      return behavior.apply.call(vn, data, value, oldValue, expression, scope);
    };
  }
})(Galaxy);
