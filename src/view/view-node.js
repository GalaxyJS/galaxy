/* global Galaxy, Promise */
'use strict';

Galaxy.View.ViewNode = /** @class */ (function (GV) {
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
    if (tagName === 'svg' || (parentViewNode && parentViewNode.schema.tag === 'svg')) {
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

  GV.NODE_SCHEMA_PROPERTY_MAP['node'] = {
    type: 'attr'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['lifecycle'] = {
    type: 'prop',
    name: 'lifecycle'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['renderConfig'] = {
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
   * @param schemas
   * @memberOf Galaxy.View.ViewNode
   * @static
   */
  ViewNode.cleanReferenceNode = function (schemas) {
    if (schemas instanceof Array) {
      schemas.forEach(function (node) {
        ViewNode.cleanReferenceNode(node);
      });
    } else if (schemas instanceof Object) {
      __node__.value = null;
      defProp(schemas, 'node', __node__);
      ViewNode.cleanReferenceNode(schemas.children);
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

  ViewNode.REMOVE_SELF = function (flag) {
    const viewNode = this;
    if (!flag) {
      if (!viewNode.placeholder.parentNode) {
        insertBefore(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
      }

      if (viewNode.node.parentNode) {
        removeChild(viewNode.node.parentNode, viewNode.node);
      }
    } else {
      viewNode.node.parentNode && removeChild(viewNode.node.parentNode, viewNode.node);
      viewNode.placeholder.parentNode && removeChild(viewNode.placeholder.parentNode, viewNode.placeholder);
      viewNode.hasBeenDestroyed();
    }
  };

  /**
   *
   * @param schema
   * @param {Galaxy.View.ViewNode} parent
   * @param {Node|Element|null} node
   * @param {Node|Element|null} refNode
   * @param {Galaxy.View} view
   * @constructor
   * @memberOf Galaxy.View
   */
  function ViewNode(parent, schema, node, refNode, view) {
    const _this = this;
    _this.view = view;
    /** @type {Node|Element|*} */
    _this.node = node || createElem(schema.tag || 'div', parent);
    _this.refNode = refNode || _this.node;
    _this.schema = schema;
    _this.data = {};
    _this.localPropertyNames = new Set();
    _this.inputs = {};
    _this.virtual = false;
    _this.placeholder = createComment(schema.tag || 'div');
    _this.properties = [];
    _this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    _this.setters = {};
    /** @type {galaxy.View.ViewNode} */
    _this.parent = parent;
    _this.dependedObjects = [];
    _this.observer = new Galaxy.Observer(_this);
    _this.origin = false;
    _this.transitory = false;

    const cache = {};
    defProp(_this, 'cache', {
      enumerable: false,
      configurable: false,
      value: cache
    });

    _this.hasBeenRendered = null;
    _this.rendered = new Promise(function (done) {
      _this.hasBeenRendered = function () {
        _this.rendered.resolved = true;
        done();

        _this.callLifecycleEvent('rendered');
      };
    });
    _this.rendered.resolved = false;

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
    this.schema.renderConfig = Object.assign({}, ViewNode.GLOBAL_RENDER_CONFIG, schema.renderConfig || {});

    __node__.value = this.node;
    defProp(this.schema, 'node', __node__);

    referenceToThis.value = this;
    defProp(this.node, '_gvn', referenceToThis);
    defProp(this.placeholder, '_gvn', referenceToThis);

    _this.callLifecycleEvent('postCreate');
  }

  ViewNode.prototype = {
    query: function (selectors) {
      return this.node.querySelector(selectors);
    },
    /**
     *
     * @param {string} id event id
     */
    callLifecycleEvent: function (id) {
      const lifecycle = this.schema.lifecycle;
      if (lifecycle && typeof lifecycle[id] === 'function') {
        lifecycle[id].apply(this, Array.prototype.slice.call(arguments, 1));
      }
    },

    broadcast: function (event) {
      this.node.dispatchEvent(event);
    },

    cloneSchema: function () {
      const schemaClone = Object.assign({}, this.schema);
      ViewNode.cleanReferenceNode(schemaClone);

      defProp(schemaClone, 'mother', {
        value: this.schema,
        writable: false,
        enumerable: false,
        configurable: false
      });

      return schemaClone;
    },

    virtualize: function () {
      this.placeholder.nodeValue = JSON.stringify(this.schema, null, 2);
      this.virtual = true;
      this.setInDOM(false);
    },

    populateEnterSequence: EMPTY_CALL,

    populateLeaveSequence: null,

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

      // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
      if (flag && !_this.virtual) {
        _this.callLifecycleEvent('preInsert');

        if (!_this.node.parentNode) {
          insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          removeChild(_this.placeholder.parentNode, _this.placeholder);
        }

        _this.callLifecycleEvent('postInsert');
        _this.node.style.setProperty('display', 'none');
        _this.hasBeenInserted();

        GV.CREATE_IN_NEXT_FRAME(_this.index, function () {
          // _this.node.style.display = '';
          _this.node.style.removeProperty('display');
          _this.hasBeenRendered();
          _this.populateEnterSequence();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.callLifecycleEvent('preRemove');

        _this.origin = true;
        _this.transitory = true;
        GV.DESTROY_IN_NEXT_FRAME(_this.index, () => {
          _this.populateLeaveSequence(false);
          _this.origin = false;
          _this.transitory = false;
          _this.node.style.cssText = '';
          _this.callLifecycleEvent('postAnimations');
          _this.stream.pour('removed', 'dom');
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

      if (_this.contentRef) {
        _this.contentRef.insertBefore(childNode.placeholder, position);
      } else {
        _this.node.insertBefore(childNode.placeholder, position);
      }
    },

    createNode: function (schema, localScope) {
      this.view.createNode(schema, this, localScope);
    },

    /**
     * @param {Galaxy.View.ReactiveData} reactiveData
     * @param {string} propertyName
     * @param {Function} expression
     */
    installSetter: function (reactiveData, propertyName, expression) {
      const _this = this;
      _this.registerProperty(reactiveData);

      _this.setters[propertyName] = GV.createSetter(_this, propertyName, reactiveData, expression);
      if (!_this.setters[propertyName]) {
        _this.setters[propertyName] = function () {
          console.error('No setter for property :', propertyName, '\nNode:', _this);
        };
      }
    },

    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     */
    registerProperty: function (reactiveData) {
      if (this.properties.indexOf(reactiveData) === -1) {
        this.properties.push(reactiveData);
      }
    },
    hasAnimation: function () {
      const _this = this;
      const children = _this.getChildNodes();

      if (_this.populateLeaveSequence) {
        return true;
      }

      for (let i = 0, len = children.length; i < len; i++) {
        const node = children[i];
        if (node.populateLeaveSequence) {
          return true;
        }

        if (node.hasAnimation()) {
          return true;
        }
      }

      return false;
    },
    updateChildrenLeaveSequence: function (hasAnimation) {
      const _this = this;
      const children = _this.getChildNodes();

      if (hasAnimation) {
        if (!_this.populateLeaveSequence) {
          _this.populateLeaveSequence = EMPTY_CALL;
        }
      } else {
        _this.populateLeaveSequence = ViewNode.REMOVE_SELF;
        return;
      }

      for (let i = 0, len = children.length; i < len; i++) {
        children[i].updateChildrenLeaveSequence(hasAnimation);
      }
    },

    /**
     *
     */
    destroy: function () {
      const _this = this;
      _this.transitory = true;

      if (_this.inDOM) {
        const flag = _this.hasAnimation();
        _this.updateChildrenLeaveSequence(flag);
        _this.clean();
      }
      GV.DESTROY_IN_NEXT_FRAME(_this.index, () => {
        if (_this.inDOM) {
          _this.populateLeaveSequence(true);
          _this.callLifecycleEvent('postRemove');
          _this.callLifecycleEvent('postDestroy');
        }

        _this.properties.forEach(function (reactiveData) {
          reactiveData.removeNode(_this);
        });

        _this.dependedObjects.forEach(function (dependent) {
          dependent.reactiveData.removeNode(dependent.item);
        });

        _this.properties = [];
        _this.dependedObjects = [];
        _this.inDOM = false;
        _this.schema.node = undefined;
        _this.inputs = {};
      });
    },

    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     * @param {Object} item
     */
    addDependedObject: function (reactiveData, item) {
      this.dependedObjects.push({ reactiveData: reactiveData, item: item });
    },

    getChildNodes: function () {
      const nodes = [];
      const cn = Array.prototype.slice.call(this.node.children, 0);
      for (let i = cn.length - 1; i >= 0; i--) {
        // const node = cn[i]['_gvn'];

        // if (node !== undefined) {
        //   nodes.push(node);
        // }
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
     * @return {Galaxy.Sequence}
     */
    clean: function () {
      const _this = this;
      // const toBeRemoved = _this.getChildNodes();
      GV.destroyNodes(_this, _this.getChildNodes());
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
      this.observer.notify(name, value, oldValue);
    }
  };

  return ViewNode;

})(Galaxy.View);
