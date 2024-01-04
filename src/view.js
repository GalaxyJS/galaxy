import { arr_concat, clone, def_prop, EMPTY_CALL, obj_keys } from './utils.js';
import Scope from './scope.js';
import ViewNode from './view-node.js';
import ArrayChange from './array-change.js';
import { NODE_BLUEPRINT_PROPERTY_MAP, VALID_TAG_NAMES } from './constants.js';
import prop_setter from './setters/prop.js';
import attr_setter from './setters/attr.js';
import reactive_setter from './setters/reactive.js';
import { text_property, text_3_property, text_8_property } from './properties/text.property.js';
import { data_property } from './properties/data.reactive.js';
import { animations_property } from './properties/animations.property.js';
import { checked_property } from './properties/checked.property.js';
import { class_property } from './properties/class.reactive.js';
import { disabled_property } from './properties/disabled.property.js';
import { if_property } from './properties/if.reactive.js';
import { module_property } from './properties/module.reactive.js';
import { on_property } from './properties/on.property.js';
import { repeat_property } from './properties/repeat.reactive.js';
import { selected_property } from './properties/selected.property.js';
import { style_3_property, style_8_property, style_property } from './properties/style.reactive.js';
import { value_config_property, value_property } from './properties/value.property.js';
import { visible_property } from './properties/visible.reactive.js';
import ReactiveData from './reactive-data.js';

const ARG_BINDING_SINGLE_QUOTE_RE = /=\s*'<([^\[\]<>]*)>(.*)'/m;
const ARG_BINDING_DOUBLE_QUOTE_RE = /=\s*'=\s*"<([^\[\]<>]*)>(.*)"/m;
const FUNCTION_HEAD_RE = /^\(\s*([^)]+?)\s*\)|^function.*\(\s*([^)]+?)\s*\)/m;
const BINDING_RE = /^<([^\[\]<>]*)>\s*([^<>]*)\s*$|^=\s*([^\[\]<>]*)\s*$/;
const PROPERTY_NAME_SPLITTER_RE = /\.|\[([^\[\]\n]+)]|([^.\n\[\]]+)/g;

const REACTIVE_BEHAVIORS = {};

for (const key in NODE_BLUEPRINT_PROPERTY_MAP) {
  if (NODE_BLUEPRINT_PROPERTY_MAP[key].type === 'reactive') {
    REACTIVE_BEHAVIORS[key] = true;
  }
}

const PROPERTY_SETTERS = {
  'none': function () {
    return EMPTY_CALL;
  },
  'prop': prop_setter,
  'attr': attr_setter,
  'reactive': reactive_setter
};

export function max_index() {
  return '@' + performance.now();
}

// let opt_count = 0;
// const _next_batch = function (_jump, dirty) {
//   if (dirty) {
//     return _jump();
//   }
//
//   if (opt_count > 233) {
//     opt_count = 0;
//     // console.log(performance.now());
//     return requestAnimationFrame(() => {
//       if (dirty) {
//         return _jump();
//       }
//
//       if (this.length) {
//         this.shift()(_next_batch.bind(this, _jump));
//       } else {
//         _jump();
//       }
//     });
//   }
//
//   opt_count++;
//   if (this.length) {
//     this.shift()(_next_batch.bind(this, _jump));
//   } else {
//     _jump();
//   }
// };

function parse_bind_exp_string(propertyKey, clean) {
  const matches = propertyKey.match(PROPERTY_NAME_SPLITTER_RE);
  const result = matches.filter(a => a !== '' && a !== '.');

  if (clean) {
    return result.map(p => {
      if (p.indexOf('[') === 0) {
        return p.substring(1, p.length - 1);
      }
      return p;
    });
  }

  return result;
}

/**
 *
 * @param data
 * @param {string} properties
 * @return {*}
 */
function safe_property_lookup(data, properties) {
  const propertiesArr = parse_bind_exp_string(properties, true);
  let property = propertiesArr[0];
  const original = data;
  let target = data;
  let temp = data;
  // var nestingLevel = 0;
  if (data[property] === undefined) {
    while (temp.__parent__) {
      if (temp.__parent__.hasOwnProperty(property)) {
        target = temp.__parent__;
        break;
      }

      temp = temp.__parent__;
    }

    // if the property is not found in the parents then return the original object as the context
    if (target[property] === undefined) {
      target = original;
    }
  }

  target = target || {};
  const lastIndex = propertiesArr.length - 1;
  propertiesArr.forEach(function (key, i) {
    target = target[key];

    if (i !== lastIndex && !(target instanceof Object)) {
      target = {};
    }
  });

  if (target instanceof ArrayChange) {
    return target.getInstance();
  }

  return target === undefined ? null : target;
}

const dom_manipulation_table = View.DOM_MANIPLATION = {};
const create_order = [], destroy_order = [];
let dom_manipulation_order = [];
let manipulation_done = true, dom_manipulations_dirty = false;
let diff = 0, preTS = 0, too_many_jumps;

const next_action = function (_jump, dirty) {
  if (dirty) {
    return _jump();
  }

  if (this.length) {
    this.shift()(next_action.bind(this, _jump));
  } else {
    _jump();
  }
};

const next_batch_body = function () {
  if (this.length) {
    let key = this.shift();
    let batch = dom_manipulation_table[key];
    if (!batch.length) {
      return next_batch.call(this);
    }

    next_action.call(batch, next_batch.bind(this), dom_manipulations_dirty);
  } else {
    manipulation_done = true;
    preTS = 0;
    diff = 0;
  }
};

const next_batch = function () {
  if (dom_manipulations_dirty) {
    dom_manipulations_dirty = false;
    diff = 0;
    return next_batch.call(dom_manipulation_order);
  }

  const now = performance.now();
  preTS = preTS || now;
  diff = diff + (now - preTS);
  preTS = now;

  if (diff > 2) {
    diff = 0;
    if (too_many_jumps) {
      clearTimeout(too_many_jumps);
      too_many_jumps = null;
    }

    too_many_jumps = setTimeout((ts) => {
      preTS = ts;
      next_batch_body.call(this);
    });
  } else {
    next_batch_body.call(this);
  }
};

function comp_asc(a, b) {
  return a > b;
}

function comp_desc(a, b) {
  return a < b;
}

function binary_search(array, key, _fn) {
  let start = 0;
  let end = array.length - 1;
  let index = 0;

  while (start <= end) {
    let middle = Math.floor((start + end) / 2);
    let midVal = array[middle];

    if (_fn(key, midVal)) {
      // continue searching to the right
      index = start = middle + 1;
    } else {
      // search searching to the left
      index = middle;
      end = middle - 1;
    }
  }

  return index;
}

function pos_asc(array, el) {
  if (el < array[0]) {
    return 0;
  }

  if (el > array[array.length - 1]) {
    return array.length;
  }

  return binary_search(array, el, comp_asc);
}

function pos_desc(array, el) {
  if (el > array[0]) {
    return 0;
  }

  if (el < array[array.length - 1]) {
    return array.length;
  }

  return binary_search(array, el, comp_desc);
}

function add_dom_manipulation(index, act, order, search) {
  if (index in dom_manipulation_table) {
    dom_manipulation_table[index].push(act);
  } else {
    dom_manipulation_table[index] = [act];
    order.splice(search(order, index), 0, index);
  }
}

let last_dom_manipulation_id = 0;

function update_dom_manipulation_order() {
  if (last_dom_manipulation_id !== 0) {
    clearTimeout(last_dom_manipulation_id);
    last_dom_manipulation_id = 0;
  }

  dom_manipulation_order = arr_concat(destroy_order, create_order);
  last_dom_manipulation_id = setTimeout(() => {
    if (manipulation_done) {
      manipulation_done = false;
      next_batch.call(dom_manipulation_order);
    }
  });
}

// function update_on_animation_frame() {
//   if (last_dom_manipulation_id) {
//     clearTimeout(last_dom_manipulation_id);
//     last_dom_manipulation_id = null;
//   }
//
//   dom_manipulation_order = arrConcat(destroy_order, create_order);
//   last_dom_manipulation_id = setTimeout(() => {
//     if (manipulation_done) {
//       manipulation_done = false;
//       next_batch.call(dom_manipulation_order);
//     }
//   });
// }
//
// function update_on_timeout() {
//   if (last_dom_manipulation_id) {
//     cancelAnimationFrame(last_dom_manipulation_id);
//     last_dom_manipulation_id = null;
//   }
//
//   dom_manipulation_order = arrConcat(destroy_order, create_order);
//   last_dom_manipulation_id = requestAnimationFrame(() => {
//     if (manipulation_done) {
//       manipulation_done = false;
//       next_batch.call(dom_manipulation_order);
//     }
//   });
// }

/**
 *
 * @param {string} index
 * @param {Function} action
 * @memberOf Galaxy.View
 * @static
 */
export function destroy_in_next_frame(index, action) {
  dom_manipulations_dirty = true;
  add_dom_manipulation('<' + index, action, destroy_order, pos_desc);
  update_dom_manipulation_order();
}

/**
 *
 * @param {string} index
 * @param {Function} action
 * @memberOf Galaxy.View
 * @static
 */
export function create_in_next_frame(index, action) {
  dom_manipulations_dirty = true;
  add_dom_manipulation('>' + index, action, create_order, pos_asc);
  update_dom_manipulation_order();
}

/**
 *
 * @param {Array<Galaxy.ViewNode>} toBeRemoved
 * @param {boolean} hasAnimation
 * @memberOf Galaxy.View
 * @static
 */
export function destroy_nodes(toBeRemoved, hasAnimation) {
  let remove = null;

  for (let i = 0, len = toBeRemoved.length; i < len; i++) {
    remove = toBeRemoved[i];
    remove.destroy(hasAnimation);
  }
}

/**
 *
 * @param {Galaxy.ViewNode} viewNode
 * @param value
 * @param name
 */
export function set_attr(viewNode, value, name) {
  if (value !== null && value !== undefined && value !== false) {
    viewNode.node.setAttribute(name, value === true ? '' : value);
  } else {
    viewNode.node.removeAttribute(name);
  }
}

export function set_prop(viewNode, value, name) {
  viewNode.node[name] = value;
}

export function create_child_scope(parent) {
  let result = {};

  def_prop(result, '__parent__', {
    enumerable: false,
    value: parent
  });

  def_prop(result, '__scope__', {
    enumerable: false,
    value: parent.__scope__ || parent
  });

  return result;
}

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

  if (valueType === 'string') {
    const props = value.match(BINDING_RE);
    if (props) {
      bindTypes = [props[1]];
      propertyKeys = [props[2]];
      propertyValues = [value];
    }
  } else if (valueType === 'function') {
    isExpression = true;
    expressionFunction = value;
    const matches = value.toString().match(FUNCTION_HEAD_RE);
    if (matches) {
      const args = matches[1] || matches [2];
      propertyValues = args.split(',').map(a => {
        const argDef = a.indexOf('"') === -1 ? a.match(ARG_BINDING_SINGLE_QUOTE_RE) : a.match(ARG_BINDING_DOUBLE_QUOTE_RE);
        if (argDef) {
          bindTypes.push(argDef[1]);
          propertyKeys.push(argDef[2]);
          return '<>' + argDef[2];
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
    expressionFn: null
  };
}

export function property_lookup(data, key) {
  const propertiesArr = parse_bind_exp_string(key, true);
  let firstKey = propertiesArr[0];
  const original = data;
  let target = data;
  let temp = data;
  let nestingLevel = 0;
  let parent;
  if (data[firstKey] === undefined) {
    while (temp.__parent__) {
      parent = temp.__parent__;
      if (parent.hasOwnProperty(firstKey)) {
        target = parent;
        break;
      }

      if (nestingLevel++ >= 1000) {
        throw Error('Maximum nested property lookup has reached `' + firstKey + '`\n' + data);
      }

      temp = parent;
    }

    // if the property is not found in the parents then return the original object as the context
    if (target[firstKey] === undefined) {
      return original;
    }
  }

  return target;
};

/**
 *
 * @param data
 * @param absoluteKey
 * @returns {Galaxy.View.ReactiveData}
 */
export function property_rd_lookup(data, absoluteKey) {
  const keys = absoluteKey.split('.');
  const li = keys.length - 1;
  let target = data;
  keys.forEach(function (p, i) {
    target = property_lookup(target, p);

    if (i !== li) {
      if (!target[p]) {
        const rd = target.__rd__.refs.filter(ref => ref.shadow[p])[0];
        target = rd.shadow[p].data;
      } else {
        target = target[p];
      }
    }
  });

  return target.__rd__;
}

const EXPRESSION_ARGS_FUNC_CACHE = {};

export function create_args_provider_fn(propertyValues) {
  const id = propertyValues.join();

  if (EXPRESSION_ARGS_FUNC_CACHE[id]) {
    return EXPRESSION_ARGS_FUNC_CACHE[id];
  }

  let functionContent = 'return [';
  let middle = [];
  for (let i = 0, len = propertyValues.length; i < len; i++) {
    const val = propertyValues[i];
    if (typeof val === 'string') {
      if (val.indexOf('<>this.') === 0) {
        middle.push('_prop(this.data, "' + val.replace('<>this.', '') + '")');
      } else if (val.indexOf('<>') === 0) {
        middle.push('_prop(scope, "' + val.replace('<>', '') + '")');
      }
    } else {
      middle.push('_var[' + i + ']');
    }
  }
  functionContent += middle.join(',') + ']';

  const func = new Function('scope, _prop , _var', functionContent);
  EXPRESSION_ARGS_FUNC_CACHE[id] = func;

  return func;
}

export function create_expression_fn(host, scope, handler, keys, values) {
  if (!values[0]) {
    if (host instanceof ViewNode) {
      values[0] = host.data;
    } else {
      values[0] = scope;
    }
  }

  const getExpressionArguments = create_args_provider_fn(values);

  return function () {
    let args = [];
    try {
      args = getExpressionArguments.call(host, scope, safe_property_lookup, values);
    } catch (ex) {
      console.error('Can\'t find the property: \n' + keys.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
        ' of its property.\n\n', scope, '\n', ex);
    }

    return handler.apply(host, args);
  };
}

/**
 *
 * @param bindings
 * @param target
 * @param scope
 * @returns {Function|boolean}
 */
export function get_expression_fn(bindings, target, scope) {
  if (!bindings.isExpression) {
    return false;
  }

  if (bindings.expressionFn) {
    return bindings.expressionFn;
  }

  // Generate expression arguments
  try {
    bindings.expressionFn = create_expression_fn(target, scope, bindings.handler, bindings.propertyKeys, bindings.propertyValues);
    return bindings.expressionFn;
  } catch (exception) {
    throw Error(exception.message + '\n' + bindings.propertyKeys);
  }
}

/**
 *
 * @param {Galaxy.ViewNode | Object} target
 * @param {String} targetKeyName
 * @param {Galaxy.View.ReactiveData} hostReactiveData
 * @param {Galaxy.View.ReactiveData} scopeData
 * @param {Object} bindings
 * @param {Galaxy.ViewNode | undefined} root
 */
export function make_binding(target, targetKeyName, hostReactiveData, scopeData, bindings, root) {
  const propertyKeys = bindings.propertyKeys;
  const expressionFn = get_expression_fn(bindings, root, scopeData);

  let propertyScopeData = scopeData;
  let propertyKey = null;
  let childPropertyKeyPath = null;
  let initValue = null;
  let propertyKeyPathItems = [];
  for (let i = 0, len = propertyKeys.length; i < len; i++) {
    propertyKey = propertyKeys[i];
    childPropertyKeyPath = null;
    const bindType = bindings.bindTypes[i];
    // let matches = propertyKey.match(PROPERTY_NAME_SPLITTER_RE);
    // propertyKeyPathItems = matches.filter(a => a !== '' && a !== '.');
    propertyKeyPathItems = parse_bind_exp_string(propertyKey);

    if (propertyKeyPathItems.length > 1) {
      propertyKey = propertyKeyPathItems[0];
      childPropertyKeyPath = propertyKeyPathItems.slice(1).join('.');
    }

    if (!hostReactiveData && scopeData /*&& !(scopeData instanceof G.Scope)*/) {
      if ('__rd__' in scopeData) {
        hostReactiveData = scopeData.__rd__;
      } else {
        hostReactiveData = new ReactiveData(null, scopeData, scopeData instanceof Scope ? scopeData.systemId : 'child');
      }
    }

    if (propertyKeyPathItems[0] === 'Scope') {
      throw new Error('`Scope` keyword must be omitted when it is used  used in bindings: ' + propertyKeys.join('.'));
    }

    if (propertyKey.indexOf('[') === 0) {
      propertyKey = propertyKey.substring(1, propertyKey.length - 1);
    }

    // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
    if (propertyKeyPathItems[0] === 'this' && propertyKey === 'this' && root instanceof ViewNode) {
      propertyKey = propertyKeyPathItems[1];
      bindings.propertyKeys = propertyKeyPathItems.slice(2);
      childPropertyKeyPath = null;
      hostReactiveData = new ReactiveData('data', root.data, 'this');
      propertyScopeData = property_lookup(root.data, propertyKey);
    } else if (propertyScopeData) {
      // Look for the property host object in scopeData hierarchy
      propertyScopeData = property_lookup(propertyScopeData, propertyKey);
    }

    initValue = propertyScopeData;
    if (propertyScopeData !== null && typeof propertyScopeData === 'object') {
      initValue = propertyScopeData[propertyKey];
    }

    let reactiveData;
    if (initValue instanceof Object) {
      reactiveData = new ReactiveData(propertyKey, initValue, hostReactiveData || scopeData.__scope__.__rd__);
    } else if (childPropertyKeyPath) {
      reactiveData = new ReactiveData(propertyKey, null, hostReactiveData);
    } else if (hostReactiveData) {
      // if the propertyKey is used for a repeat reactive property, then we assume its type is Array.
      hostReactiveData.addKeyToShadow(propertyKey, targetKeyName === 'repeat');
    }

    if (childPropertyKeyPath === null) {
      if (!(target instanceof ViewNode)) {
        def_prop(target, targetKeyName, {
          set: function ref_set(newValue) {
            // console.warn('It is not allowed', hostReactiveData, targetKeyName);
            // Not sure about this part
            // This will provide binding to primitive data types as well.
            if (expressionFn) {
              // console.log(newValue, target[targetKeyName], targetKeyName, propertyKey);
              // console.warn('It is not allowed to set value for an expression', targetKeyName, newValue);
              return;
            }

            if (hostReactiveData.data[propertyKey] === newValue) {
              return;
            }

            hostReactiveData.data[propertyKey] = newValue;
          },
          get: function ref_get() {
            if (expressionFn) {
              return expressionFn();
            }

            return hostReactiveData.data[propertyKey];
          },
          enumerable: true,
          configurable: true
        });
      }

      if (hostReactiveData && scopeData instanceof Scope) {
        // If the propertyKey is referring to some local value then there is no error
        if (target instanceof ViewNode && target.localPropertyNames.has(propertyKey)) {
          return;
        }

        // throw new Error('Binding to Scope direct properties is not allowed.\n' +
        //   'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.parsedURL + '\nProperty name: `' +
        //   propertyKey + '`\n');
      }

      hostReactiveData.addNode(target, targetKeyName, propertyKey, bindType, expressionFn);
    }

    if (childPropertyKeyPath !== null) {
      make_binding(target, targetKeyName, reactiveData, initValue, Object.assign({}, bindings, { propertyKeys: [childPropertyKeyPath] }), root);
    }
  }
}

/**
 * Bind subjects to the data and takes care of dependent objects
 * @param viewNode
 * @param subjects
 * @param data
 * @param cloneSubject
 * @returns {*}
 */
export function bind_subjects_to_data(viewNode, subjects, data, cloneSubject) {
  const keys = obj_keys(subjects);
  let attributeName;
  let attributeValue;
  const subjectsClone = cloneSubject ? clone(subjects) : subjects;

  let parentReactiveData;
  if (!(data instanceof Scope)) {
    parentReactiveData = new ReactiveData(null, data, 'BSTD');
  }

  for (let i = 0, len = keys.length; i < len; i++) {
    attributeName = keys[i];
    attributeValue = subjectsClone[attributeName];

    // Object that have __singleton property will be ignored
    if (attributeValue.__singleton__) {
      continue;
    }

    // if (attributeValue instanceof Galaxy.Router) {
    //   console.log(attributeName, attributeValue)
    //   continue;
    // }

    const bindings = get_bindings(attributeValue);
    if (bindings.propertyKeys.length) {
      make_binding(subjectsClone, attributeName, parentReactiveData, data, bindings, viewNode);
      if (viewNode) {
        bindings.propertyKeys.forEach(function (path) {
          try {
            const rd = property_rd_lookup(data, path);
            viewNode.finalize.push(() => {
              rd.removeNode(subjectsClone);
            });
          } catch (error) {
            console.error('bind_subjects_to_data -> Could not find: ' + path + '\n in', data, error);
          }
        });
      }
    }

    if (attributeValue && typeof attributeValue === 'object' && !(attributeValue instanceof Array)) {
      bind_subjects_to_data(viewNode, attributeValue, data);
    }
  }

  return subjectsClone;
}

/**
 *
 * @param {Galaxy.ViewNode} node
 * @param scopeData
 * @param {string} key
 * @param {any} value
 * @return boolean
 */
export function install_property_for_node(node, scopeData, key, value) {
  if (key in REACTIVE_BEHAVIORS) {
    if (value === null || value === undefined) {
      return false;
    }

    const reactiveProperty = NODE_BLUEPRINT_PROPERTY_MAP[key];
    const data = reactiveProperty.getConfig.call(node, scopeData, node.blueprint[key]);
    if (data !== undefined) {
      node.cache[key] = data;
    }

    return reactiveProperty.install.call(node, data);
  }

  return true;
}

/**
 *
 * @param viewNode
 * @param {string} propertyKey
 * @param {Galaxy.View.ReactiveData} scopeProperty
 * @param expression
 */
export function activate_property_for_node(viewNode, propertyKey, scopeProperty, expression) {
  /**
   *
   * @type {Galaxy.View.BlueprintProperty}
   */
  const property = NODE_BLUEPRINT_PROPERTY_MAP[propertyKey] || { type: 'attr' };
  property.key = property.key || propertyKey;
  if (typeof property.beforeActivate !== 'undefined') {
    property.beforeActivate(viewNode, scopeProperty, propertyKey, expression);
  }

  viewNode.setters[propertyKey] = get_property_setter_for_node(property, viewNode, scopeProperty, expression);
}

/**
 *
 * @param {Galaxy.View.BlueprintProperty} blueprintProperty
 * @param {Galaxy.ViewNode} viewNode
 * @param [scopeProperty]
 * @param {Function} [expression]
 * @returns {Galaxy.View.EMPTY_CALL|(function())}
 */
export function get_property_setter_for_node(blueprintProperty, viewNode, scopeProperty, expression) {
  // if viewNode is virtual, then the expression should be ignored
  if (blueprintProperty.type !== 'reactive' && viewNode.virtual) {
    return EMPTY_CALL;
  }
  // This is the lowest level where the developer can modify the property setter behavior
  // By defining 'createSetter' for the property you can implement your custom functionality for setter
  if (typeof blueprintProperty.getSetter !== 'undefined') {
    return blueprintProperty.getSetter(viewNode, blueprintProperty, blueprintProperty, expression);
  }

  return PROPERTY_SETTERS[blueprintProperty.type](viewNode, blueprintProperty, expression);
}

/**
 *
 * @param {Galaxy.ViewNode} viewNode
 * @param {string} propertyKey
 * @param {*} value
 */
export function set_property_for_node(viewNode, propertyKey, value) {
  const bpKey = propertyKey + '_' + viewNode.node.nodeType;
  let property = NODE_BLUEPRINT_PROPERTY_MAP[bpKey] || NODE_BLUEPRINT_PROPERTY_MAP[propertyKey];
  if (!property) {
    property = { type: 'prop' };
    if (!(propertyKey in viewNode.node) && 'setAttribute' in viewNode.node) {
      property = { type: 'attr' };
    }

    NODE_BLUEPRINT_PROPERTY_MAP[bpKey] = property;
  }

  property.key = property.key || propertyKey;

  switch (property.type) {
    case 'attr':
    case 'prop':
    case 'reactive':
      get_property_setter_for_node(property, viewNode)(value, null);
      break;

    case 'event':
      viewNode.node[propertyKey] = function (event) {
        value.call(viewNode, event, viewNode.data);
      };
      break;
  }
}

View.COMPONENTS = {};

/**
 *
 * @param {Galaxy.Scope} scope
 * @constructor
 * @memberOf Galaxy
 */
function View(scope) {
  const _this = this;
  _this.scope = scope;

  if (scope.element instanceof ViewNode) {
    _this.container = scope.element;
    // Nested views should inherit components from their parent view
    _this._components = Object.assign({}, scope.element.view._components);
  } else {
    _this.container = new ViewNode({
      tag: scope.element
    }, null, _this);

    _this.container.setInDOM(true);
  }
}

function TimelineControl(type) {
  this.type = type;
}

TimelineControl.prototype.startKeyframe = function (timeline, position) {
  if (!timeline) {
    throw new Error('Argument Missing: view.' + this.type + '.startKeyframe(timeline:string) needs a `timeline`');
  }

  position = position || '+=0';

  const animations = {
    [this.type]: {
      // keyframe: true,
      to: {
        data: 'timeline:start',
        duration: 0.001
      },
      timeline,
      position
    }
  };

  return {
    tag: 'comment',
    text: ['', this.type + ':timeline:start', 'position: ' + position, 'timeline: ' + timeline, ''].join('\n'),
    animations
  };
};

TimelineControl.prototype.keyframe = function (onComplete, timeline, position) {
  if (!timeline) {
    throw new Error('Argument Missing: view.' + this.type + '.addKeyframe(timeline:string) needs a `timeline`');
  }

  const animations = {
    [this.type]: {
      // keyframe: true,
      to: {
        duration: 0.001,
        onComplete
      },
      timeline,
      position,
    }
  };

  return {
    tag: 'comment',
    text: this.type + ':timeline:keyframe',
    animations
  };
};

TimelineControl.prototype.waitKeyframe = function (timeline, position) {
  if (!timeline) {
    throw new Error('Argument Missing: view.' + this.type + '.addKeyframe(timeline:string) needs a `timeline`');
  }

  const animations = {
    [this.type]: {
      to: {
        duration: 0.001
      },
      timeline,
      position,
    }
  };

  return {
    tag: 'comment',
    text: this.type + ':timeline:waitKeyframe',
    animations
  };
};

View.prototype = {
  _components: {},
  components: function (map) {
    for (const key in map) {
      const comp = map[key];
      if (typeof comp !== 'function') {
        throw new Error('Component must be type of function: ' + key);
      }

      this._components[key] = comp;
    }
  },
  /**
   *
   */
  entering: new TimelineControl('enter'),

  leaving: new TimelineControl('leave'),

  /**
   *
   * @param {string} key
   * @param blueprint
   * @param {Galaxy.Scope|Object} scopeData
   * @returns {*}
   */
  getComponent: function (key, blueprint, scopeData) {
    let componentScope = scopeData;
    let componentBlueprint = blueprint;
    if (key) {
      if (key in this._components) {
        if (blueprint.props && typeof blueprint.props !== 'object') {
          throw new Error('The `props` must be a literal object.');
        }

        componentScope = create_child_scope(scopeData);
        Object.assign(componentScope, blueprint.props || {});

        bind_subjects_to_data(null, componentScope, scopeData);
        componentBlueprint = this._components[key].call(null, componentScope, blueprint, this);
        if (blueprint instanceof Array) {
          throw new Error('A component\'s blueprint can NOT be an array. A component must have only one root node.');
        }
      } else if (VALID_TAG_NAMES.indexOf(key) === -1) {
        console.warn('Invalid component/tag: ' + key);
      }
    }

    return {
      blueprint: Object.assign(blueprint, componentBlueprint),
      scopeData: componentScope
    };
  },

  /**
   *
   * @param {{enter?: AnimationConfig, leave?:AnimationConfig}} animations
   * @returns Blueprint
   */
  addTimeline: function (animations) {
    return {
      tag: 'comment',
      text: 'timeline',
      animations
    };
  },

  /**
   *
   * @param {Blueprint|Blueprint[]} blueprint
   * @return {Galaxy.ViewNode|Array<Galaxy.ViewNode>}
   */
  blueprint: function (blueprint) {
    const _this = this;
    return this.createNode(blueprint, _this.scope, _this.container, null);
  },
  /**
   *
   * @param {boolean} [hasAnimation]
   */
  clean: function (hasAnimation) {
    this.container.clean(hasAnimation);
  },
  dispatchEvent: function (event) {
    this.container.dispatchEvent(event);
  },
  /**
   *
   * @param {Object} blueprint
   * @param {Object} scopeData
   * @param {Galaxy.ViewNode} parent
   * @param {Node|Element|null} position
   * @return {Galaxy.ViewNode|Array<Galaxy.ViewNode>}
   */
  createNode: function (blueprint, scopeData, parent, position) {
    const _this = this;
    let i = 0, len = 0;
    if (typeof blueprint === 'string') {
      const content = document.createElement('div');
      content.innerHTML = blueprint;
      const nodes = Array.prototype.slice.call(content.childNodes);
      nodes.forEach(function (node) {
        // parent.node.appendChild(node);
        const viewNode = new ViewNode({ tag: node }, parent, _this);
        parent.registerChild(viewNode, position);
        node.parentNode.removeChild(node);
        set_property_for_node(viewNode, 'animations', {});
        viewNode.setInDOM(true);
      });

      return nodes;
    } else if (typeof blueprint === 'function') {
      return blueprint.call(_this);
    } else if (blueprint instanceof Array) {
      const result = [];
      for (i = 0, len = blueprint.length; i < len; i++) {
        result.push(_this.createNode(blueprint[i], scopeData, parent, null));
      }

      return result;
    } else if (blueprint instanceof Object) {
      const component = _this.getComponent(blueprint.tag, blueprint, scopeData);
      let propertyValue, propertyKey;
      const _blueprint = component.blueprint;
      const keys = obj_keys(_blueprint);
      const needInitKeys = [];
      const viewNode = new ViewNode(_blueprint, parent, _this, component.scopeData);
      parent.registerChild(viewNode, position);

      // Behaviors installation stage
      for (i = 0, len = keys.length; i < len; i++) {
        propertyKey = keys[i];
        propertyValue = _blueprint[propertyKey];

        const needValueAssign = install_property_for_node(viewNode, component.scopeData, propertyKey, propertyValue);
        if (needValueAssign === false) {
          continue;
        }

        needInitKeys.push(propertyKey);
      }

      // Value assignment stage
      for (i = 0, len = needInitKeys.length; i < len; i++) {
        propertyKey = needInitKeys[i];
        if (propertyKey === 'children') continue;

        propertyValue = _blueprint[propertyKey];
        const bindings = get_bindings(propertyValue);
        if (bindings.propertyKeys.length) {
          make_binding(viewNode, propertyKey, null, component.scopeData, bindings, viewNode);
        } else {
          set_property_for_node(viewNode, propertyKey, propertyValue);
        }
      }

      if (!viewNode.virtual) {
        viewNode.setInDOM(true);
        if (_blueprint.children) {
          _this.createNode(_blueprint.children, component.scopeData, viewNode, null);
        }
      }

      return viewNode;
    } else {
      throw Error('blueprint should NOT be null');
    }
  },

  loadStyle(path) {
    if (path.indexOf('./') === 0) {
      path = path.replace('./', this.scope.uri.path);
    }
  }
};

export default View;
