/* global Galaxy */
(function (G) {
  const NODE_BLUEPRINT_PROPERTY_MAP = G.View.NODE_BLUEPRINT_PROPERTY_MAP;
  G.View.PROPERTY_SETTERS.reactive = function (viewNode, attrName, property, expression, scope) {
    const behavior = NODE_BLUEPRINT_PROPERTY_MAP[property.name];
    const cache = viewNode.cache[attrName];

    return createReactiveFunction(behavior, viewNode, cache, expression, scope);
  };

  function createReactiveFunction(behavior, vn, data, expression, scope) {
    return function R(value, oldValue) {
      return behavior.apply.call(vn, data, value, oldValue, expression, scope);
    };
  }
})(Galaxy);
