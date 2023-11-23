import { set_attr } from '../view.js';

export default function attr_setter(viewNode, property, expression) {
  const attrName = property.key;
  const updateFn = property.update || set_attr;
  const setter = create_attr_setter(updateFn, viewNode, attrName);

  if (expression) {
    return function A_EXP() {
      const expressionValue = expression();
      setter(expressionValue);
    };
  }

  return setter;
};

function create_attr_setter(updateFn, viewNode, attrName) {
  return function A(value) {
    if (value instanceof Promise) {
      const asyncCall = function (asyncValue) {
        updateFn(viewNode, asyncValue, attrName);
      };
      value.then(asyncCall).catch(asyncCall);
    } else if (value instanceof Function) {
      const result = value.call(viewNode, viewNode.data);
      updateFn(viewNode, result, attrName);
    } else {
      updateFn(viewNode, value, attrName);
    }
  };
}
