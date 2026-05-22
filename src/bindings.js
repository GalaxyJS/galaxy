import { NODE_BLUEPRINT_PROPERTY_MAP } from "./constants.js";

const ARG_BINDING_SINGLE_QUOTE_RE = /=\s*'<([^\[\]<>]*)>(.*)'/m;
const ARG_BINDING_DOUBLE_QUOTE_RE = /=\s*'=\s*"<([^\[\]<>]*)>(.*)"/m;
const FUNCTION_HEAD_RE = /^\(\s*([^)]+?)\s*\)|^function.*\(\s*([^)]+?)\s*\)/m;
const BINDING_RE = /^<([^\[\]<>]*)>\s*([^<>]*)\s*$|^=\s*([^\[\]<>]*)\s*$/;

/**
 *
 * @param {string|Array} value
 * @return {{propertyKeys: *[], propertyValues: *[], bindTypes: *[], isExpression: boolean, expressionFn: null}}
 */
export function get_bindings(value) {
  let propertyKeys = [];
  let propertyValues = [];
  let bindTypes = [];
  let isExpression = false;
  const valueType = typeof (value);
  let expressionFunction = null;

  if (valueType === "string") {
    const props = value.match(BINDING_RE);
    if (props) {
      bindTypes = [props[1]];
      propertyKeys = [props[2]];
      propertyValues = [value];
    }
  } else if (valueType === "function") {
    isExpression = true;
    expressionFunction = value;
    const matches = value.toString().match(FUNCTION_HEAD_RE);
    if (matches) {
      const args = matches[1] || matches [2];
      propertyValues = args.split(",").map(a => {
        const argDef = a.indexOf("\"") === -1 ? a.match(ARG_BINDING_SINGLE_QUOTE_RE) : a.match(ARG_BINDING_DOUBLE_QUOTE_RE);
        if (argDef) {
          bindTypes.push(argDef[1]);
          propertyKeys.push(argDef[2]);
          return "<>" + argDef[2];
        } else {
          return undefined;
        }
      });
    }
  }

  return {
    propertyKeys: propertyKeys,
    propertyValues: propertyValues,
    bindTypes: bindTypes,
    handler: expressionFunction,
    isExpression: isExpression,
    expressionFn: null,
  };
}
