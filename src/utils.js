export function EMPTY_CALL() {
}

export const def_prop = Object.defineProperty;
export const del_prop = Reflect.deleteProperty;

export const obj_keys = Object.keys;
export const arr_concat = Array.prototype.concat.bind([]);

export const arr_slice = Array.prototype.slice;

const INDEX_BASE = 36;
const INDEX_WIDTH = 4;
const INDEX_MAX = INDEX_BASE ** INDEX_WIDTH - 1;
const INDEX_CACHE_LIMIT = 4096;
const INDEX_CACHE = Array.from({ length: INDEX_CACHE_LIMIT }, (_, idx) => {
  return idx.toString(INDEX_BASE).padStart(INDEX_WIDTH, "0");
});

export function create_index(i) {
  if (!Number.isFinite(i)) return INDEX_CACHE[0];

  i = Math.floor(i);
  if (i < 0) return INDEX_CACHE[0];
  if (i < INDEX_CACHE_LIMIT) return INDEX_CACHE[i];

  if (i > INDEX_MAX) {
    throw new Error("ViewNode index overflow: " + i + ". Increase INDEX_WIDTH to support larger sibling indexes.");
  }

  return i.toString(INDEX_BASE).padStart(INDEX_WIDTH, "0");
}

export function clone(obj) {
  let cloned = obj instanceof Array ? [] : {};
  cloned.__proto__ = obj.__proto__;
  for (let i in obj) {
    if (obj.hasOwnProperty(i)) {
      const v = obj[i];
      // Some objects can not be cloned and must be passed by reference
      if (v instanceof Promise || v?.__singleton__) {
        cloned[i] = v;
      } else if (typeof (v) === "object" && v !== null) {
        if (i === "animations" && v && typeof v === "object") {
          cloned[i] = v;
        } else {
          cloned[i] = clone(v);
        }
      } else {
        cloned[i] = v;
      }
    }
  }

  return cloned;
}

const COMMENT_NODE = document.createComment("");

export function create_comment(t) {
  const n = COMMENT_NODE.cloneNode();
  n.textContent = t;
  return n;
}

/**
 *
 * @param {string} tagName
 * @param {ViewNode} parentViewNode
 * @returns {HTMLElement|Comment|SVGElement}
 */
export function create_elem(tagName, parentViewNode) {
  if (tagName === "svg" || (parentViewNode && parentViewNode.blueprint.tag === "svg")) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
  }

  if (tagName === "comment") {
    return document.createComment("ViewNode");
  }

  return document.createElement(tagName);
}



