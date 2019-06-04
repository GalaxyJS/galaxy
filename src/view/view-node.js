/* global Galaxy, Promise */
'use strict';

Galaxy.View.ViewNode = /** @class */ (function (GV) {
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;

  function createComment(t) {
    return commentNode.cloneNode(t);
  }

  /**
   *
   * @param t
   * @param {Galaxy.View.ViewNode} p
   * @returns {any}
   */
  function createElem(t, p) {
    if (t === 'svg' || (p && p.schema.tag === 'svg')) {
      return document.createElementNS('http://www.w3.org/2000/svg', t);
    }

    return t === 'comment' ? document.createComment('ViewNode') : document.createElement(t);
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

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param {Array<Galaxy.View.ViewNode>} toBeRemoved
   * @param {Galaxy.Sequence} sequence
   * @param {Galaxy.Sequence} root
   * @memberOf Galaxy.View.ViewNode
   * @static
   */
  ViewNode.destroyNodes = function (node, toBeRemoved, sequence, root) {
    let remove = null;

    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      // remove.renderingFlow.truncate();
      remove.destroy(sequence, root);
    }
  };

  ViewNode.createIndex = function (i) {
    if (i < 10) {
      return i + '';
    }

    let r = '9';
    let res = i - 10;
    while (res >= 10) {
      r += '9';
      res -= 10;
    }

    return r + res;
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
    // _this.renderingFlow = new Galaxy.Sequence();
    // _this.sequences = {
    //   enter: new Galaxy.Sequence(),
    //   leave: new Galaxy.Sequence(),
    //   destroy: new Galaxy.Sequence(),
    //   classList: new Galaxy.Sequence()
    // };
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
    defProp(this.node, 'galaxyViewNode', referenceToThis);
    defProp(this.placeholder, 'galaxyViewNode', referenceToThis);

    _this.callLifecycleEvent('postCreate');
  }

  ViewNode.prototype = {
    querySelector: function (selectors) {
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

    /**
     *
     * @param {Galaxy.Sequence} sequence
     */
    populateEnterSequence: function (sequence) {
    },

    /**
     *
     * @param {Galaxy.Sequence} sequence
     */
    populateLeaveSequence: function (sequence) {

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
      // const enterSequence = _this.sequences.enter;
      // const leaveSequence = _this.sequences.leave;

      // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
      if (flag && !_this.virtual) {
        // leaveSequence.truncate();
        _this.callLifecycleEvent('preInsert');

        if (!_this.node.parentNode) {
          insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          removeChild(_this.placeholder.parentNode, _this.placeholder);
        }

        _this.callLifecycleEvent('postInsert');
        _this.node.style.visibility = 'hidden';
        // console.log(_this.node, _this.index);
        GV.CREATE_IN_NEXT_FRAME(_this, function () {
          _this.node.style.visibility = null;
          _this.hasBeenInserted();
          _this.populateEnterSequence();
          _this.hasBeenRendered();
        });
      } else if (!flag && _this.node.parentNode) {
        // enterSequence.truncate();
        _this.callLifecycleEvent('preRemove');

        _this.origin = true;
        _this.transitory = true;

        GV.DESTROY_IN_NEXT_FRAME(_this, () => {
          _this.populateLeaveSequence(false);

          // if (!_this.placeholder.parentNode) {
          //   insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
          // }
          // _this.callLifecycleEvent('postLeave');
          //
          // if (_this.node.parentNode) {
          //   removeChild(_this.node.parentNode, _this.node);
          // }
          // _this.callLifecycleEvent('postRemove');

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
      // childNode.parent = _this;

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

    /**
     *
     * @param {Galaxy.Sequence} mainLeaveSequence
     * @param {Galaxy.Sequence} rootSequence
     */
    destroy: function (mainLeaveSequence, rootSequence) {
      const _this = this;
      _this.transitory = true;
      const leaveSequence = true;

      // The node is the original node that is being removed
      if (!mainLeaveSequence) {
        _this.origin = true;
        if (_this.inDOM) {
          _this.clean(leaveSequence, rootSequence);
          _this.populateLeaveSequence(leaveSequence);

          GV.DESTROY_IN_NEXT_FRAME(_this, () => {
            // _this.node.parentNode && removeChild(_this.node.parentNode, _this.node);
            //
            // _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
            _this.callLifecycleEvent('postRemove');
            _this.callLifecycleEvent('postDestroy');

            _this.node.style.cssText = '';
          });
        }
      } else if (mainLeaveSequence) {
        if (_this.inDOM) {
          _this.clean(leaveSequence, rootSequence);
          _this.populateLeaveSequence(leaveSequence);

          GV.DESTROY_IN_NEXT_FRAME(_this, () => {
            // _this.node.parentNode && removeChild(_this.node.parentNode, _this.node);
            //
            // _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
            _this.callLifecycleEvent('postRemove');
            _this.callLifecycleEvent('postDestroy');
          });
        }
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
      const cn = Array.prototype.slice.call(this.node.childNodes, 0);
      for (let i = cn.length - 1; i >= 0; i--) {
        const node = cn[i]['galaxyViewNode'];

        if (node !== undefined) {
          nodes.push(node);
        }
      }

      return nodes;
    },

    get index() {
      if (this.parent) {
        const i = Array.prototype.indexOf.call(this.parent.node.childNodes, this.anchor);
        return this.parent.index + '-' + (ViewNode.createIndex(i) || 0);
      }
      return 0;
    },

    flush: function (nodes) {
      const items = nodes || this.getChildNodes();
      items.forEach(function (vn) {
        vn.node.parentNode && removeChild(vn.node.parentNode, vn.node);
      });

    },

    /**
     *
     * @param {Galaxy.Sequence} leaveSequence
     * @param {Galaxy.Sequence} root
     * @return {Galaxy.Sequence}
     */
    clean: function (leaveSequence, root) {
      const _this = this;
      const toBeRemoved = _this.getChildNodes();

      // If leaveSequence is present we assume that this is being destroyed as a child, therefore its
      // children should also get destroyed as child
      if (leaveSequence) {
        GV.DESTROY_IN_NEXT_FRAME(_this, () => {
          GV.destroyNodes(_this, toBeRemoved, leaveSequence, root);
        });

        return;
      }

      GV.DESTROY_IN_NEXT_FRAME(_this, () => {
        GV.destroyNodes(_this, toBeRemoved, null, root);
      });
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
