import { NODE_BLUEPRINT_PROPERTY_MAP } from './constants.js';
import { arr_slice, create_comment, create_elem, def_prop, EMPTY_CALL } from './utils.js';
import {
  activate_property_for_node,
  create_in_next_frame,
  destroy_in_next_frame, destroy_nodes
} from './view.js';
import { data_property } from './properties/data.reactive.js';
import { text_3_property, text_8_property, text_property } from './properties/text.property.js';
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
import Scope from './scope.js';

NODE_BLUEPRINT_PROPERTY_MAP['data'] = data_property;
NODE_BLUEPRINT_PROPERTY_MAP['text_3'] = text_3_property;
NODE_BLUEPRINT_PROPERTY_MAP['text_8'] = text_8_property;
NODE_BLUEPRINT_PROPERTY_MAP['text'] = text_property;
NODE_BLUEPRINT_PROPERTY_MAP['animations'] = animations_property;
NODE_BLUEPRINT_PROPERTY_MAP['checked'] = checked_property;
NODE_BLUEPRINT_PROPERTY_MAP['class'] = class_property;
NODE_BLUEPRINT_PROPERTY_MAP['disabled'] = disabled_property;
NODE_BLUEPRINT_PROPERTY_MAP['if'] = if_property;
NODE_BLUEPRINT_PROPERTY_MAP['module'] = module_property;
NODE_BLUEPRINT_PROPERTY_MAP['on'] = on_property;
NODE_BLUEPRINT_PROPERTY_MAP['repeat'] = repeat_property;
NODE_BLUEPRINT_PROPERTY_MAP['selected'] = selected_property;
NODE_BLUEPRINT_PROPERTY_MAP['style'] = style_property;
NODE_BLUEPRINT_PROPERTY_MAP['style_3'] = style_3_property;
NODE_BLUEPRINT_PROPERTY_MAP['style_8'] = style_8_property;
NODE_BLUEPRINT_PROPERTY_MAP['value.config'] = value_config_property;
NODE_BLUEPRINT_PROPERTY_MAP['value'] = value_property;
NODE_BLUEPRINT_PROPERTY_MAP['visible'] = visible_property;
NODE_BLUEPRINT_PROPERTY_MAP['_create'] = {
  type: 'prop',
  key: '_create',
  getSetter: () => EMPTY_CALL
};

NODE_BLUEPRINT_PROPERTY_MAP['_render'] = {
  type: 'prop',
  key: '_render',
  getSetter: () => EMPTY_CALL
};

NODE_BLUEPRINT_PROPERTY_MAP['_destroy'] = {
  type: 'prop',
  key: '_destroy',
  getSetter: () => EMPTY_CALL
};

NODE_BLUEPRINT_PROPERTY_MAP['renderConfig'] = {
  type: 'prop',
  key: 'renderConfig'
};

const REFERENCE_TO_THIS = {
  value: this,
  configurable: false,
  enumerable: false
};

const __NODE__ = {
  value: null,
  configurable: false,
  enumerable: false,
  writable: true
};

function insert_before(parentNode, newNode, referenceNode) {
  parentNode.insertBefore(newNode, referenceNode);
}

function remove_child(node, child) {
  node.removeChild(child);
}

function remove_self(destroy) {
  const viewNode = this;

  if (destroy) {
    // Destroy
    viewNode.node.parentNode && remove_child(viewNode.node.parentNode, viewNode.node);
    viewNode.placeholder.parentNode && remove_child(viewNode.placeholder.parentNode, viewNode.placeholder);
    viewNode.garbage.forEach(function (node) {
      remove_self.call(node, true);
    });
    viewNode.hasBeenDestroyed();
  } else {
    // Detach
    if (!viewNode.placeholder.parentNode) {
      insert_before(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
    }

    if (viewNode.node.parentNode) {
      remove_child(viewNode.node.parentNode, viewNode.node);
    }

    viewNode.garbage.forEach(function (node) {
      remove_self.call(node, true);
    });
  }

  viewNode.garbage = [];
}

/**
 *
 * @typedef {Object} RenderConfig
 * @property {boolean} [applyClassListAfterRender] - Indicates whether classlist applies after the render.
 * @property {boolean} [renderDetached] - Make the node to be rendered in a detached mode.
 */

/**
 *
 * @type {RenderConfig}
 */
ViewNode.GLOBAL_RENDER_CONFIG = {
  applyClassListAfterRender: false,
  renderDetached: false
};

/**
 *
 * @param blueprints
 * @memberOf Galaxy.ViewNode
 * @static
 */
ViewNode.cleanReferenceNode = function (blueprints) {
  if (blueprints instanceof Array) {
    blueprints.forEach(function (node) {
      ViewNode.cleanReferenceNode(node);
    });
  } else if (blueprints instanceof Object) {
    blueprints.node = null;
    ViewNode.cleanReferenceNode(blueprints.children);
  }
};

ViewNode.createIndex = function (i) {
  if (i < 0) return '0';
  if (i < 10) return i + '';

  let r = '9';
  let res = i - 10;
  while (res >= 10) {
    r += '9';
    res -= 10;
  }

  return r + res;
};

/**
 * @typedef {Object} Blueprint
 * @memberOf Galaxy
 * @property {RenderConfig} [renderConfig]
 * @property {string|Node} [tag]
 * @property {function} [_create]
 * @property {function} [_render]
 * @property {function} [_destroy]
 */

/**
 *
 * @param {Blueprint} blueprint
 * @param {Galaxy.ViewNode|null} parent
 * @param {Galaxy.View} view
 * @param {any} [nodeData]
 * @constructor
 * @memberOf Galaxy
 */
function ViewNode(blueprint, parent, view, nodeData) {
  const _this = this;
  _this.view = view;
  if (blueprint.tag instanceof Node) {
    _this.node = blueprint.tag;
    blueprint.tag = blueprint.tag.tagName;
  } else {
    _this.node = create_elem(blueprint.tag || 'div', parent);
  }

  // if node does not have style property, then it doesn't have processEnterAnimation
  if (!('style' in _this.node)) {
    _this.processEnterAnimation = EMPTY_CALL;
  }

  /**
   *
   * @type {Blueprint}
   */
  _this.blueprint = blueprint;
  _this.data = nodeData instanceof Scope ? {} : nodeData;
  _this.localPropertyNames = new Set();
  _this.inputs = {};
  _this.virtual = false;
  _this.visible = true;
  _this.placeholder = create_comment(blueprint.tag || 'div');
  _this.properties = new Set();
  _this.inDOM = false;
  _this.setters = {};
  _this.parent = parent;
  _this.finalize = [];
  _this.origin = false;
  _this.destroyOrigin = 0;
  _this.transitory = false;
  _this.garbage = [];
  _this.leaveWithParent = false;
  _this.onLeaveComplete = remove_self.bind(_this, true);

  const cache = {};
  def_prop(_this, 'cache', {
    enumerable: false,
    configurable: false,
    value: cache
  });

  _this.rendered = new Promise(function (done) {
    if ('style' in _this.node) {
      _this.hasBeenRendered = function () {
        _this.rendered.resolved = true;
        _this.node.style.removeProperty('display');
        if (_this.blueprint._render) {
          _this.blueprint._render.call(_this, _this.data);
        }
        done(_this);
      };
    } else {
      _this.hasBeenRendered = function () {
        _this.rendered.resolved = true;
        done();
      };
    }
  });
  _this.rendered.resolved = false;

  _this.destroyed = new Promise(function (done) {
    _this.hasBeenDestroyed = function () {
      _this.destroyed.resolved = true;
      if (_this.blueprint._destroy) {
        _this.blueprint._destroy.call(_this, _this.data);
      }
      done();
    };
  });
  _this.destroyed.resolved = false;

  /**
   *
   * @type {RenderConfig}
   */
  _this.blueprint.renderConfig = Object.assign({}, ViewNode.GLOBAL_RENDER_CONFIG, blueprint.renderConfig || {});

  __NODE__.value = this.node;
  def_prop(_this.blueprint, 'node', __NODE__);

  REFERENCE_TO_THIS.value = this;
  if (!_this.node.__vn__) {
    def_prop(_this.node, '__vn__', REFERENCE_TO_THIS);
    def_prop(_this.placeholder, '__vn__', REFERENCE_TO_THIS);
  }

  if (_this.blueprint._create) {
    _this.blueprint._create.call(_this, _this.data);
  }
}

ViewNode.prototype = {
  onLeaveComplete: null,

  dump: function () {
    let original = this.parent;
    let targetGarbage = this.garbage;
    // Find the garbage of the origin if
    while (original.transitory) {
      if (original.blueprint.hasOwnProperty('if') && !this.blueprint.hasOwnProperty('if')) {
        targetGarbage = original.garbage;
      }
      if (original.parent && original.parent.transitory) {
        original = original.parent;
      } else {
        break;
      }
    }
    targetGarbage.push(this);

    this.garbage = [];
  },
  query: function (selectors) {
    return this.node.querySelector(selectors);
  },

  dispatchEvent: function (event) {
    this.node.dispatchEvent(event);
  },

  cloneBlueprint: function () {
    const blueprintClone = Object.assign({}, this.blueprint);
    ViewNode.cleanReferenceNode(blueprintClone);

    def_prop(blueprintClone, 'mother', {
      value: this.blueprint,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return blueprintClone;
  },

  virtualize: function () {
    this.placeholder.nodeValue = JSON.stringify(this.blueprint, (k, v) => {
      return k === 'children' ? '<children>' : k === 'animations' ? '<animations>' : v;
    }, 2);
    this.virtual = true;
    this.setInDOM(false);
  },

  processEnterAnimation: function () {
    this.node.style.display = null;
  },

  processLeaveAnimation: EMPTY_CALL,

  populateHideSequence: function () {
    this.node.style.display = 'none';
  },

  /**
   *
   * @param {boolean} flag
   */
  setInDOM: function (flag) {
    const _this = this;
    if (_this.blueprint.renderConfig.renderDetached) {
      create_in_next_frame(_this.index, (_next) => {
        _this.blueprint.renderConfig.renderDetached = false;
        _this.hasBeenRendered();
        _next();
      });
      return;
    }

    _this.inDOM = flag;
    if (_this.virtual) return;

    if (flag) {
      if ('style' in _this.node) {
        _this.node.style.setProperty('display', 'none');
      }

      if (!_this.node.parentNode) {
        insert_before(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
      }

      if (_this.placeholder.parentNode) {
        remove_child(_this.placeholder.parentNode, _this.placeholder);
      }

      create_in_next_frame(_this.index, (_next) => {
        _this.hasBeenRendered();
        _this.processEnterAnimation();
        _next();
      });

      const children = _this.getChildNodesAsc();
      const len = children.length;
      for (let i = 0; i < len; i++) {
        // console.log(children[i].node);
        children[i].setInDOM(true);
      }
    } else if (!flag && _this.node.parentNode) {
      _this.origin = true;
      _this.transitory = true;
      const defaultProcessLeaveAnimation = _this.processLeaveAnimation;
      const children = _this.getChildNodes();
      _this.prepareLeaveAnimation(_this.hasAnimation(children), children);
      destroy_in_next_frame(_this.index, (_next) => {
        _this.processLeaveAnimation(remove_self.bind(_this, false));
        _this.origin = false;
        _this.transitory = false;
        _this.processLeaveAnimation = defaultProcessLeaveAnimation;
        _next();
      });
    }
  },

  setVisibility: function (flag) {
    const _this = this;
    _this.visible = flag;

    if (flag && !_this.virtual) {
      create_in_next_frame(_this.index, (_next) => {
        _this.node.style.display = null;
        _this.processEnterAnimation();
        _next();
      });
    } else if (!flag && _this.node.parentNode) {
      _this.origin = true;
      _this.transitory = true;
      destroy_in_next_frame(_this.index, (_next) => {
        _this.populateHideSequence();
        _this.origin = false;
        _this.transitory = false;
        _next();
      });
    }
  },

  /**
   *
   * @param {Galaxy.ViewNode} childNode
   * @param position
   */
  registerChild: function (childNode, position) {
    this.node.insertBefore(childNode.placeholder, position);
  },

  createNode: function (blueprint, localScope) {
    this.view.createNode(blueprint, localScope, this);
  },

  /**
   * @param {string} propertyKey
   * @param {Galaxy.View.ReactiveData} reactiveData
   * @param {Function} expression
   */
  registerActiveProperty: function (propertyKey, reactiveData, expression) {
    this.properties.add(reactiveData);
    activate_property_for_node(this, propertyKey, reactiveData, expression);
  },

  snapshot: function (animations) {
    const rect = this.node.getBoundingClientRect();
    const node = this.node.cloneNode(true);
    const style = {
      margin: '0',
      width: rect.width + 'px',
      height: rect.height + ' px',
      top: rect.top + 'px',
      left: rect.left + 'px',
      position: 'fixed',
    };
    Object.assign(node.style, style);

    return {
      tag: node,
      style: style
    };
  },

  hasAnimation: function (children) {
    if (this.processLeaveAnimation && this.processLeaveAnimation !== EMPTY_CALL) {
      return true;
    }

    for (let i = 0, len = children.length; i < len; i++) {
      const node = children[i];
      if (node.hasAnimation(node.getChildNodes())) {
        return true;
      }
    }

    return false;
  },

  prepareLeaveAnimation: function (hasAnimation, children) {
    const _this = this;

    if (hasAnimation) {
      if (_this.processLeaveAnimation === EMPTY_CALL) {
        if (_this.origin) {
          _this.processLeaveAnimation = function () {
            remove_self.call(_this, false);
          };
        }
          // if a child has an animation and this node is being removed directly, then we need to remove this node
        // in order for element to get removed properly
        else if (_this.destroyOrigin === 1) {
          remove_self.call(_this, true);
        }
      } else if (_this.processLeaveAnimation !== EMPTY_CALL && !_this.origin) {
        // Children with leave animation should not get removed from dom for visual purposes.
        // Since their this node already has a leave animation and eventually will be removed from dom.
        // this is not the case for when this node is being detached by if
        // const children = _this.getChildNodes();
        for (let i = 0, len = children.length; i < len; i++) {
          children[i].onLeaveComplete = EMPTY_CALL;
        }
      }
    } else {
      _this.processLeaveAnimation = function () {
        remove_self.call(_this, !_this.origin);
      };
    }
  },

  destroy: function (hasAnimation) {
    const _this = this;
    _this.transitory = true;
    if (_this.parent.destroyOrigin === 0) {
      // destroy() has been called on this node
      _this.destroyOrigin = 1;
    } else {
      // destroy() has been called on a parent node
      _this.destroyOrigin = 2;
    }

    if (_this.inDOM) {
      const children = _this.getChildNodes();
      hasAnimation = hasAnimation || _this.hasAnimation(children);
      _this.prepareLeaveAnimation(hasAnimation, children);
      _this.clean(hasAnimation, children);
    }

    _this.properties.forEach((reactiveData) => reactiveData.removeNode(_this));
    let len = _this.finalize.length;
    for (let i = 0; i < len; i++) {
      _this.finalize[i].call(_this);
    }

    destroy_in_next_frame(_this.index, (_next) => {
      _this.processLeaveAnimation(_this.destroyOrigin === 2 ? EMPTY_CALL : _this.onLeaveComplete);
      _this.localPropertyNames.clear();
      _this.properties.clear();
      _this.finalize = [];
      _this.inDOM = false;
      _this.inputs = {};
      _this.view = null;
      _this.parent = null;
      Reflect.deleteProperty(_this.blueprint, 'node');
      _next();
    });
  },

  getChildNodes: function () {
    const nodes = [];
    const cn = arr_slice.call(this.node.childNodes, 0);
    for (let i = cn.length - 1; i >= 0; i--) {
      // All the nodes that are ViewNode
      const node = cn[i];
      if ('__vn__' in node) {
        nodes.push(node['__vn__']);
      }
    }

    return nodes;
  },

  getChildNodesAsc: function () {
    const nodes = [];
    const cn = arr_slice.call(this.node.childNodes, 0);
    for (let i = 0; i < cn.length; i++) {
      // All the nodes that are ViewNode
      const node = cn[i];
      if ('__vn__' in node) {
        nodes.push(node['__vn__']);
      }
    }

    return nodes;
  },

  /**
   *
   */
  clean: function (hasAnimation, children) {
    children = children || this.getChildNodes();
    destroy_nodes(children, hasAnimation);

    destroy_in_next_frame(this.index, (_next) => {
      let len = this.finalize.length;
      for (let i = 0; i < len; i++) {
        this.finalize[i].call(this);
      }
      this.finalize = [];
      _next();
    });
  },

  createNext: function (act) {
    create_in_next_frame(this.index, act);
  },

  get index() {
    const parent = this.parent;

    // This solution is very performant but might not be reliable
    if (parent) {
      let prevNode = this.placeholder.parentNode ? this.placeholder.previousSibling : this.node.previousSibling;
      if (prevNode) {
        if (!prevNode.hasOwnProperty('__index__')) {
          let i = 0;
          let node = this.node;
          while ((node = node.previousSibling) !== null) ++i;
          prevNode.__index__ = i;
        }
        this.node.__index__ = prevNode.__index__ + 1;
      } else {
        this.node.__index__ = 0;
      }

      return parent.index + ',' + ViewNode.createIndex(this.node.__index__);
    }

    return '0';
  },

  get anchor() {
    if (this.inDOM) {
      return this.node;
    }

    return this.placeholder;
  }
};

export default ViewNode;
