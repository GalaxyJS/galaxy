/* global Galaxy, Promise */
Galaxy.View.ViewNode = /** @class */ (function (G) {
  const GV = G.View;
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;
  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;
  const CREATE_IN_NEXT_FRAME = G.View.CREATE_IN_NEXT_FRAME;
  const DESTROY_IN_NEXT_FRAME = G.View.DESTROY_IN_NEXT_FRAME;

  function create_comment(t) {
    const n = commentNode.cloneNode();
    n.textContent = t;
    return n;
  }

  /**
   *
   * @param {string} tagName
   * @param {Galaxy.View.ViewNode} parentViewNode
   * @returns {HTMLElement|Comment}
   */
  function create_elem(tagName, parentViewNode) {
    if (tagName === 'svg' || (parentViewNode && parentViewNode.blueprint.tag === 'svg')) {
      return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    if (tagName === 'comment') {
      return document.createComment('ViewNode');
    }

    return document.createElement(tagName);
  }

  function insert_before(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  }

  function remove_child(node, child) {
    node.removeChild(child);
  }

  const referenceToThis = {
    value: this,
    configurable: false,
    enumerable: false
  };

  const __node__ = {
    value: null,
    configurable: false,
    enumerable: false,
    writable: true
  };

  const arrIndexOf = Array.prototype.indexOf;
  const arrSlice = Array.prototype.slice;

  //------------------------------

  GV.NODE_BLUEPRINT_PROPERTY_MAP['node'] = {
    type: 'none'
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_create'] = {
    type: 'prop',
    key: '_create',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_render'] = {
    type: 'prop',
    key: '_render',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_destroy'] = {
    type: 'prop',
    key: '_destroy',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['renderConfig'] = {
    type: 'prop',
    key: 'renderConfig'
  };

  /**
   *
   * @typedef {Object} RenderConfig
   * @property {boolean} [applyClassListAfterRender] - Indicates whether classlist applies after the render.
   * @property {boolean} [renderDetached] - Make the node to be rendered in a detached mode.
   */

  /**
   * @typedef {Object} Blueprint
   * @memberOf Galaxy
   * @property {RenderConfig} [renderConfig]
   * @property {string} [tag]
   * @property {function} [_create]
   * @property {function} [_render]
   * @property {function} [_destroy]
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
   * @memberOf Galaxy.View.ViewNode
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

  function REMOVE_SELF(destroy) {
    const viewNode = this;

    if (destroy) {
      // Destroy
      viewNode.node.parentNode && remove_child(viewNode.node.parentNode, viewNode.node);
      viewNode.placeholder.parentNode && remove_child(viewNode.placeholder.parentNode, viewNode.placeholder);
      viewNode.garbage.forEach(function (node) {
        REMOVE_SELF.call(node, true);
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
        REMOVE_SELF.call(node, true);
      });
    }

    viewNode.garbage = [];
  }

  /**
   *
   * @param {Blueprint} blueprint
   * @param {Galaxy.View.ViewNode} parent
   * @param {Galaxy.View} view
   * @param {any} nodeData
   * @constructor
   * @memberOf Galaxy.View
   */
  function ViewNode(blueprint, parent, view, nodeData) {
    const _this = this;
    _this.view = view;
    /** @type {Node|Element|*} */
    if (blueprint.tag instanceof Node) {
      _this.node = blueprint.tag;
      blueprint.tag = blueprint.tag.tagName;
      if (_this.node instanceof Text) {
        _this.processEnterAnimation = EMPTY_CALL;
      }
    } else {
      _this.node = create_elem(blueprint.tag || 'div', parent);
    }

    /**
     *
     * @type {Blueprint}
     */
    _this.blueprint = blueprint;
    _this.data = nodeData instanceof Galaxy.Scope ? {} : nodeData;
    _this.localPropertyNames = new Set();
    _this.inputs = {};
    _this.virtual = false;
    _this.visible = true;
    _this.placeholder = create_comment(blueprint.tag || 'div');
    _this.properties = new Set();
    _this.inDOM = false;
    _this.setters = {};
    /** @type {Galaxy.View.ViewNode} */
    _this.parent = parent;
    _this.finalize = [];
    _this.origin = false;
    _this.destroyOrigin = 0;
    _this.transitory = false;
    _this.garbage = [];
    _this.leaveWithParent = false;
    _this.onLeaveComplete = REMOVE_SELF.bind(_this, true);

    const cache = {};
    defProp(_this, 'cache', {
      enumerable: false,
      configurable: false,
      value: cache
    });

    _this.rendered = new Promise(function (done) {
      if (_this.node.style) {
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

    __node__.value = this.node;
    defProp(_this.blueprint, 'node', __node__);

    referenceToThis.value = this;
    if (!_this.node.__vn__) {
      defProp(_this.node, '__vn__', referenceToThis);
      defProp(_this.placeholder, '__vn__', referenceToThis);
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

      defProp(blueprintClone, 'mother', {
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
        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.blueprint.renderConfig.renderDetached = false;
          _this.hasBeenRendered();
          _next();
        });
        return;
      }

      _this.inDOM = flag;
      if (_this.virtual) return;

      if (flag) {
        if (_this.node.style) {
          _this.node.style.setProperty('display', 'none');
        }

        if (!_this.node.parentNode) {
          insert_before(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          remove_child(_this.placeholder.parentNode, _this.placeholder);
        }

        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.hasBeenRendered();
          _this.processEnterAnimation();
          _next();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        const defaultProcessLeaveAnimation = _this.processLeaveAnimation;
        const children = _this.getChildNodes();
        _this.prepareLeaveAnimation(_this.hasAnimation(children), children);
        DESTROY_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.processLeaveAnimation(REMOVE_SELF.bind(_this, false));
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
        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.node.style.display = null;
          _this.processEnterAnimation();
          _next();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        DESTROY_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.populateHideSequence();
          _this.origin = false;
          _this.transitory = false;
          _next();
        });
      }
    },

    /**
     *
     * @param {Galaxy.View.ViewNode} childNode
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
      GV.activatePropertyForNode(this, propertyKey, reactiveData, expression);
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
        if (_this.processLeaveAnimation === EMPTY_CALL && _this.origin) {
          _this.processLeaveAnimation = function () {
            REMOVE_SELF.call(_this, false);
          };
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
          REMOVE_SELF.call(_this, !_this.origin);
        };
      }
    },

    destroy: function (hasAnimation) {
      const _this = this;
      _this.transitory = true;
      // if(!_this.parent)debugger;
      if (_this.parent.destroyOrigin === 0) {
        _this.destroyOrigin = 1;
      } else {
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

      DESTROY_IN_NEXT_FRAME(_this.index, (_next) => {
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
      const cn = arrSlice.call(this.node.childNodes, 0);
      for (let i = cn.length - 1; i >= 0; i--) {
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
      GV.DESTROY_NODES(children, hasAnimation);

      DESTROY_IN_NEXT_FRAME(this.index, (_next) => {
        let len = this.finalize.length;
        for (let i = 0; i < len; i++) {
          this.finalize[i].call(this);
        }
        this.finalize = [];
        _next();
      });
    },

    createNext: function (act) {
      CREATE_IN_NEXT_FRAME(this.index, act);
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

      // This solution is much more reliable however it's very slow
      // if (parent) {
      //   let i = 0;
      //   let node = this.node;
      //   while ((node = node.previousSibling) !== null) ++i;
      //   // i = arrIndexOf.call(parent.node.childNodes, node);
      //
      //   if (i === 0 && this.placeholder.parentNode) {
      //     i = arrIndexOf.call(parent.node.childNodes, this.placeholder);
      //   }
      //   return parent.index + ',' + ViewNode.createIndex(i);
      // }

      return '0';
    },

    get anchor() {
      if (this.inDOM) {
        return this.node;
      }

      return this.placeholder;
    }
  };

  return ViewNode;

})(Galaxy);
