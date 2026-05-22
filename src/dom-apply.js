import { def_prop } from "./utils.js";

/**
 *
 * @param {ViewNode} viewNode
 * @param value
 * @param name
 */
export function set_attr(viewNode, value, name) {
  if (value !== null && value !== undefined && value !== false) {
    viewNode.node.setAttribute(name, value === true ? "" : value);
  } else {
    viewNode.node.removeAttribute(name);
  }
}

/**
 *
 * @param {ViewNode} viewNode
 * @param value
 * @param name
 */
export function set_prop(viewNode, value, name) {
  viewNode.node[name] = value;
}
