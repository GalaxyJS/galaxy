/* global Galaxy */
(function () {
  Galaxy.View.PROPERTY_SETTERS.reactive = function (viewNode, attrName, property, expression, scope) {
    const behavior = Galaxy.View.REACTIVE_BEHAVIORS[property.name];
    const cache = viewNode.cache[attrName];

    return createReactiveFunction(behavior, viewNode, cache, expression, scope);
  };

  function createReactiveFunction(behavior, vn, data, expression, scope) {
    return function (value, oldValue) {
      return behavior.apply.call(vn, data, value, oldValue, expression, scope);
    };
  }
})();
