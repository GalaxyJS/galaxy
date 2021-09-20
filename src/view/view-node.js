/* global Galaxy, Promise */
Galaxy.View.ViewNode = /** @class */ (function (G) {
  const GV = G.View;
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;
  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;
  const CREATE_IN_NEXT_FRAME = G.View.CREATE_IN_NEXT_FRAME;
  const DESTROY_IN_NEXT_FRAME = G.View.DESTROY_IN_NEXT_FRAME;

  function createComment(t) {
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
  function createElem(tagName, parentViewNode) {
    if (tagName === 'svg' || (parentViewNode && parentViewNode.blueprint.tag === 'svg')) {
      return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    if (tagName === 'comment') {
      return document.createComment('ViewNode');
    }

    return document.createElement(tagName);
  }

  function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  }

  function removeChild(node, child) {
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
    enumerable: false
  };

  const arrIndexOf = Array.prototype.indexOf;
  const arrSlice = Array.prototype.slice;

  //------------------------------

  GV.NODE_BLUEPRINT_PROPERTY_MAP['node'] = {
    type: 'attr'
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_create'] = {
    type: 'prop',
    key: '_create',
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
   * @property {RenderConfig} [renderConfig]
   * @property {string} [tag]
   * @property {function} [_create]
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
      __node__.value = null;
      defProp(blueprints, 'node', __node__);
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

  ViewNode.REMOVE_SELF = function (destroy) {
    const viewNode = this;
    if (destroy) {
      // Destroy
      viewNode.node.parentNode && removeChild(viewNode.node.parentNode, viewNode.node);
      viewNode.placeholder.parentNode && removeChild(viewNode.placeholder.parentNode, viewNode.placeholder);
      viewNode.hasBeenDestroyed();
    } else {
      // Detach
      if (!viewNode.placeholder.parentNode) {
        insertBefore(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
      }

      if (viewNode.node.parentNode) {
        removeChild(viewNode.node.parentNode, viewNode.node);
      }

      viewNode.garbage.forEach(function (node) {
        ViewNode.REMOVE_SELF.call(node, true);
      });
      viewNode.garbage = [];
    }
  };

  /**
   *
   * @param blueprint
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
    } else {
      _this.node = createElem(blueprint.tag || 'div', parent);
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
    _this.placeholder = createComment(blueprint.tag || 'div');
    _this.properties = new Set();
    _this.inDOM = false;
    _this.setters = {};
    /** @type {Galaxy.View.ViewNode} */
    _this.parent = parent;
    _this.finalize = _this.blueprint._destroy ? [_this.blueprint._destroy] : [];
    _this.origin = false;
    _this.transitory = false;
    _this.garbage = [];
    _this.leaveWithParent = false;
    _this.onLeaveComplete = ViewNode.REMOVE_SELF.bind(_this, true);

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
          done();
        };
      } else {
        _this.hasBeenRendered = function () {
          _this.rendered.resolved = true;
          done();
        };
      }
    });
    _this.rendered.resolved = false;

    _this.inserted = new Promise(function (done) {
      _this.hasBeenInserted = function () {
        _this.inserted.resolved = true;
        done();
      };
    });
    _this.inserted.resolved = false;

    _this.destroyed = new Promise(function (done) {
      _this.hasBeenDestroyed = function () {
        _this.destroyed.resolved = true;
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
      this.parent.garbage = this.parent.garbage.concat(this.garbage);
      this.parent.garbage.push(this);
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
      this.placeholder.nodeValue = JSON.stringify(this.blueprint, null, 2);
      this.virtual = true;
      this.setInDOM(false);
    },

    populateEnterSequence: function () {
      this.node.style.display = null;
    },

    populateLeaveSequence: EMPTY_CALL,

    populateHideSequence: function () {
      this.node.style.display = 'none';
    },

    detach: function () {
      if (this.node.parentNode) {
        removeChild(this.node.parentNode, this.node);
      }
    },

    /**
     *
     * @param {boolean} flag
     */
    setInDOM: function (flag) {
      const _this = this;
      if (_this.blueprint.renderConfig.renderDetached) {
        _this.blueprint.renderConfig.renderDetached = false;
        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
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
          insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          removeChild(_this.placeholder.parentNode, _this.placeholder);
        }

        _this.hasBeenInserted();
        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.hasBeenRendered();
          _this.populateEnterSequence();
          _next();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        const defaultPopulateLeaveSequence = _this.populateLeaveSequence;
        _this.prepareLeaveSequence(_this.hasAnimation());
        DESTROY_IN_NEXT_FRAME(_this.index, () => {
          _this.populateLeaveSequence(ViewNode.REMOVE_SELF.bind(_this, false));
          _this.origin = false;
          _this.transitory = false;
          _this.populateLeaveSequence = defaultPopulateLeaveSequence;
        });
      }
    },

    setVisibility: function (flag) {
      const _this = this;
      _this.visible = flag;

      if (flag && !_this.virtual) {
        CREATE_IN_NEXT_FRAME(_this.index, (_next) => {
          _this.node.style.display = null;
          _this.populateEnterSequence();
          _next();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        DESTROY_IN_NEXT_FRAME(_this.index, () => {
          _this.populateHideSequence();
          _this.origin = false;
          _this.transitory = false;
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

    hasAnimation: function () {
      const children = this.getChildNodes();

      if (this.populateLeaveSequence && this.populateLeaveSequence !== EMPTY_CALL) {
        return true;
      }

      for (let i = 0, len = children.length; i < len; i++) {
        const node = children[i];
        if (node.leaveWithParent) {
          return true;
        }

        if (node.hasAnimation()) {
          return true;
        }
      }

      return false;
    },

    prepareLeaveSequence: function (hasAnimation) {
      const _this = this;
      if (hasAnimation) {
        if (_this.populateLeaveSequence === EMPTY_CALL && _this.origin) {
          _this.populateLeaveSequence = function () {
            ViewNode.REMOVE_SELF.call(_this, false);
          };
        } else if (_this.populateLeaveSequence !== EMPTY_CALL && !_this.origin) {
          // Children with leave animation should not get removed from dom for visual purposes.
          // Since their this node already has a leave animation and eventually will be removed from dom.
          // this is not the case for when this node is being detached by $if
          const children = _this.getChildNodes();
          for (let i = 0, len = children.length; i < len; i++) {
            children[i].onLeaveComplete = EMPTY_CALL;
          }
        }
      } else {
        _this.populateLeaveSequence = function () {
          ViewNode.REMOVE_SELF.call(_this, !_this.origin);
        };
      }
    },

    destroy: function (hasAnimation) {
      const _this = this;
      _this.transitory = true;

      if (_this.inDOM) {
        _this.prepareLeaveSequence(hasAnimation || _this.hasAnimation());
        _this.clean(hasAnimation);
      }

      _this.properties.forEach((reactiveData) => {
        reactiveData.removeNode(_this);
      });

      _this.finalize.forEach(act => act.call(_this));

      DESTROY_IN_NEXT_FRAME(_this.index, () => {
        if (_this.inDOM) {
          _this.populateLeaveSequence(_this.onLeaveComplete);
        }

        _this.localPropertyNames.clear();
        _this.properties.clear();
        _this.finalize = [];
        _this.inDOM = false;
        _this.blueprint.node = undefined;
        _this.inputs = {};
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
    clean: function (hasAnimation) {
      GV.destroyNodes(this.getChildNodes(), hasAnimation);
    },

    get index() {
      if (this.parent) {
        const childNodes = this.parent.node.childNodes;
        let i = -1;
        const node = this.node;
        for (let counter = 0, len = childNodes.length; counter < len; counter++) {
          if (childNodes[counter] === node) {
            i = counter;
            break;
          }
        }
        if (i === -1) {
          i = arrIndexOf.call(childNodes, this.placeholder);
        }
        return this.parent.index + ',' + ViewNode.createIndex(i);
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

  return ViewNode;

})(Galaxy);
