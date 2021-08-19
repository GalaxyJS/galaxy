/* global Galaxy, Promise */
Galaxy.View.ViewNode = /** @class */ (function (G) {
  const GV = G.View;
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;
  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;

  function createComment(t) {
    return commentNode.cloneNode(t);
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

  //------------------------------

  GV.NODE_BLUEPRINT_PROPERTY_MAP['node'] = {
    type: 'attr'
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['lifecycle'] = {
    type: 'prop',
    name: 'lifecycle'
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['renderConfig'] = {
    type: 'prop',
    name: 'renderConfig'
  };

  /**
   *
   * @typedef {Object} RenderConfig
   * @property {boolean} [alternateDOMFlow] - By default is undefined which is considered to be true. Entering is top down and leaving is
   * bottom up.
   * @property {boolean} [applyClassListAfterRender] - Indicates whether classlist applies after the render.
   */

  /**
   *
   * @type {RenderConfig}
   */
  ViewNode.GLOBAL_RENDER_CONFIG = {
    applyClassListAfterRender: false
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
   * @param {Node|Element|null} refNode
   * @param {Galaxy.View} view
   * @param {any} nodeData
   * @constructor
   * @memberOf Galaxy.View
   */
  function ViewNode(parent, blueprint, refNode, view, nodeData) {
    const _this = this;
    _this.view = view;
    /** @type {Node|Element|*} */
    if (blueprint.tag instanceof Node) {
      _this.node = blueprint.tag;
    } else {
      _this.node = createElem(blueprint.tag || 'div', parent);
    }

    _this.refNode = refNode || _this.node;
    _this.blueprint = blueprint;
    _this.data = nodeData || {};
    _this.localPropertyNames = new Set();
    _this.inputs = {};
    _this.virtual = false;
    _this.visible = true;
    _this.placeholder = createComment(blueprint.tag || 'div');
    _this.properties = new Set();
    _this.inDOM = typeof blueprint.inDOM === 'undefined' ? true : blueprint.inDOM;
    _this.setters = {};
    /** @type {galaxy.View.ViewNode} */
    _this.parent = parent;
    _this.finalize = [];
    // _this.observer = new Galaxy.Observer(_this);
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
      _this.hasBeenRendered = function () {
        _this.rendered.resolved = true;
        done();
      };
    });
    _this.rendered.resolved = false;

    // We need this check because a comment element has no style
    if (_this.node.style) {
      _this.node.style.setProperty('display', 'none');
      _this.rendered.then(() => _this.node.style.removeProperty('display'));
    }

    _this.inserted = new Promise(function (done) {
      _this.hasBeenInserted = function () {
        _this.inserted.resolved = true;
        _this.stream.pour('inserted', 'dom');
        done();
      };
    });
    _this.inserted.resolved = false;

    _this.destroyed = new Promise(function (done) {
      _this.hasBeenDestroyed = function () {
        _this.destroyed.resolved = true;
        _this.stream.pour('destroyed', 'dom');
        done();
      };
    });
    _this.destroyed.resolved = false;

    _this.stream = new Galaxy.Stream();

    /**
     *
     * @type {RenderConfig}
     */
    _this.blueprint.renderConfig = Object.assign({}, ViewNode.GLOBAL_RENDER_CONFIG, blueprint.renderConfig || {});

    __node__.value = this.node;
    defProp(_this.blueprint, 'node', __node__);

    referenceToThis.value = this;
    if (!_this.node._gvn) {
      defProp(_this.node, '_gvn', referenceToThis);
      defProp(_this.placeholder, '_gvn', referenceToThis);
    }
  }

  ViewNode.prototype = {
    onLeaveComplete: null,
    populateLeaveSequence: EMPTY_CALL,

    dump: function () {
      this.parent.garbage = this.parent.garbage.concat(this.garbage);
      this.parent.garbage.push(this);
      this.garbage = [];
    },
    query: function (selectors) {
      return this.node.querySelector(selectors);
    },

    broadcast: function (event) {
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

    populateHideSequence: function () {
      this.node.style.display = 'none';
    },

    detach: function () {
      const _this = this;

      if (_this.node.parentNode) {
        removeChild(_this.node.parentNode, _this.node);
      }
    },

    /**
     *
     * @param {boolean} flag
     */
    setInDOM: function (flag) {
      const _this = this;
      _this.inDOM = flag;

      if (flag && !_this.virtual) {
        if (!_this.node.parentNode) {
          insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          removeChild(_this.placeholder.parentNode, _this.placeholder);
        }

        _this.hasBeenInserted();

        GV.CREATE_IN_NEXT_FRAME(_this.index, () => {
          _this.hasBeenRendered();
          _this.populateEnterSequence();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        _this.prepareLeaveSequence(_this.hasAnimation());

        GV.DESTROY_IN_NEXT_FRAME(_this.index, () => {
          _this.populateLeaveSequence(ViewNode.REMOVE_SELF.bind(_this, false));
          _this.origin = false;
          _this.transitory = false;
          _this.node.style.cssText = '';
        });
      }
    },

    setVisibility: function (flag) {
      const _this = this;
      _this.visible = flag;

      if (flag && !_this.virtual) {
        GV.CREATE_IN_NEXT_FRAME(_this.index, () => {
          _this.node.style.display = null;
          _this.populateEnterSequence();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        GV.DESTROY_IN_NEXT_FRAME(_this.index, () => {
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
      const _this = this;
      _this.node.insertBefore(childNode.placeholder, position);
    },

    createNode: function (blueprint, localScope) {
      this.view.createNode(blueprint, this, localScope);
    },

    /**
     * @param {Galaxy.View.ReactiveData} reactiveData
     * @param {string} propertyName
     * @param {Function} expression
     */
    installSetter: function (reactiveData, propertyName, expression) {
      const _this = this;
      _this.properties.add(reactiveData);

      _this.setters[propertyName] = GV.createSetter(_this, propertyName, reactiveData, expression);
      if (!_this.setters[propertyName]) {
        _this.setters[propertyName] = function () {
          console.error('No setter for property :', propertyName, '\nNode:', _this);
        };
      }
    },

    hasAnimation: function () {
      const _this = this;
      const children = _this.getChildNodes();

      if (_this.populateLeaveSequence && _this.populateLeaveSequence !== EMPTY_CALL) {
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
          ViewNode.REMOVE_SELF.call(_this, true);
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

      GV.DESTROY_IN_NEXT_FRAME(_this.index, () => {
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
      const cn = Array.prototype.slice.call(this.node.childNodes, 0);
      for (let i = cn.length - 1; i >= 0; i--) {
        // All the nodes that are ViewNode
        const node = cn[i];
        if ('_gvn' in cn[i]) {
          nodes.push(node['_gvn']);
        }
      }

      return nodes;
    },

    get index() {
      if (this.parent) {
        const childNodes = this.parent.node.childNodes;
        let i = arrIndexOf.call(childNodes, this.placeholder);
        if (i === -1) {
          i = arrIndexOf.call(childNodes, this.node);
        }
        return this.parent.index + '.' + ViewNode.createIndex(i);
      }

      return '0';
    },

    flush: function (nodes) {
      const items = nodes || this.getChildNodes();
      items.forEach(function (vn) {
        vn.node.parentNode && removeChild(vn.node.parentNode, vn.node);
      });

    },

    /**
     *
     */
    clean: function (hasAnimation) {
      const _this = this;
      GV.destroyNodes(_this.getChildNodes(), hasAnimation);
    },

    /**
     *
     * @returns {*}
     */
    getPlaceholder: function () {
      if (this.inDOM) {
        return this.node;
      }

      return this.placeholder;
    },

    get anchor() {
      if (this.inDOM) {
        return this.node;
      }

      return this.placeholder;
    },

    /**
     *
     * @param {string} name
     * @param value
     * @param oldValue
     */
    notifyObserver: function (name, value, oldValue) {
      // console.log(name, value, oldValue);
      // this.observer.notify(name, value, oldValue);
    }
  };

  return ViewNode;

})(Galaxy);
