import Router from "./router.js";
import Scope from "./scope.js";
import Module from "./module.js";

export function EMPTY_CALL() {}

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
      if (v instanceof Promise || v instanceof Router) {
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
 * @returns {HTMLElement|Comment}
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

/**
 *
 * @param {ModuleMetaData} moduleMetaData
 * @returns {Module}
 */
export function create_module(moduleMetaData) {
  const scope = new Scope(moduleMetaData);
  return new Module(moduleMetaData, scope);
}

/**
 *
 * @param {Module}  module
 * @return {Promise<any>}
 */
export function execute_compiled_module(module) {
  return new Promise(async function(resolve, reject) {
    try {
      const source = module.source || (await import(/* @vite-ignore */"/" + module.path)).default;

      let moduleSource = source;
      if (typeof source !== "function") {
        moduleSource = function() {
          console.error("Can't find default function in %c" + module.path, "font-weight: bold;");
        };
      }

      const output = moduleSource.call(null, module.scope) || null;
      const proceed = () => {
        module.init();
        return resolve(module);
      };

      // if the function is not async, output would be undefined
      if (output) {
        output.then(proceed);
      } else {
        proceed();
      }
    } catch (error) {
      console.error(error.message + ": " + module.path);
      // console.warn('Search for es6 features in your code and remove them if your browser does not support them, e.g. arrow function');
      console.trace(error);
      reject();
    }
  });
}

const MODULE_FETCH_RESPONSE_MAP = {};

/**
 *
 * @param {ModuleMetaData} moduleMeta
 * @return {Promise<any>}
 */
export function load_module(moduleMeta) {
  if (!moduleMeta) {
    throw new Error("Module meta data or constructor is missing");
  }

  return new Promise(function(resolve, reject) {
    if (
      moduleMeta.hasOwnProperty("constructor") &&
      typeof moduleMeta.constructor === "function"
    ) {
      moduleMeta.path = moduleMeta.id =
        "internal/" +
        new Date().valueOf() +
        "-" +
        Math.round(performance.now());
      moduleMeta.source = moduleMeta.constructor;

      return execute_compiled_module(create_module(moduleMeta)).then(resolve);
    }

    moduleMeta.path =
      moduleMeta.path.indexOf("/") === 0
        ? moduleMeta.path.substring(1)
        : moduleMeta.path;

    if (!moduleMeta.id) {
      moduleMeta.id = moduleMeta.parentScope
        ? moduleMeta.parentScope.moduleId + "/" + moduleMeta.path
        : moduleMeta.path;
    }

    let url = moduleMeta.path; /*+ '?' + _this.convertToURIString(module.params || {})*/
    // contentFetcher makes sure that any module gets downloaded from network only once
    let contentFetcher = MODULE_FETCH_RESPONSE_MAP[url];
    if (!contentFetcher) {
      MODULE_FETCH_RESPONSE_MAP[url] = contentFetcher = fetch(url)
        .then((response) => {
          if (!response.ok) {
            console.error(response.statusText, url);
            return reject(response.statusText);
          }

          return response;
        }).catch(reject);
    }

    contentFetcher.then((response) => {
      return response.clone().text();
    }).then((text) => {
      return execute_compiled_module(create_module(moduleMeta));
    })
      .then(resolve)
      .catch(reject);
  });
}

