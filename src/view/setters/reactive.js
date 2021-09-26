/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.reactive = function (viewNode, property, expression, scope) {
    const propertyName = property.key;
    const updateFn = property.update;
    const config = viewNode.cache[propertyName];

    return createReactiveFunction(updateFn, viewNode, config, expression, scope);
  };

  function createReactiveFunction(updateFn, vn, config, expression, scope) {
    const nodeUpdateFn = updateFn.bind(vn);
    return function R(value) {
      return nodeUpdateFn(config, value, expression, scope);
    };
  }
})(Galaxy);
