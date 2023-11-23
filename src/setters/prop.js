import { set_prop } from '../view.js';

export default function prop_setter(viewNode, property, expression) {
  const propName = property.key;
  const updateFn = property.update || set_prop;
  const setter = create_prop_setter(updateFn, viewNode, propName);
  if (expression) {
    return function P_EXP() {
      const expressionValue = expression();
      setter(expressionValue);
    };
  }

  return setter;
};

function create_prop_setter(updateFn, viewNode, propName) {
  return function P(value) {
    if (value instanceof Promise) {
      const asyncCall = function (asyncValue) {
        updateFn(viewNode, asyncValue, propName);
      };
      value.then(asyncCall).catch(asyncCall);
    } else if (value instanceof Function) {
      const result = value.call(viewNode, viewNode.data);
      updateFn(viewNode, result, propName);
    } else {
      updateFn(viewNode, value, propName);
    }
  };
}
