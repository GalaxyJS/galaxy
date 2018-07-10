/* global Galaxy, Promise */
'use strict';

Galaxy.View.ViewNode = /** @class */ (function (GV) {
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;

  function createComment(t) {
    return commentNode.cloneNode(t);
  }

  function createElem(t) {
    return document.createElement(t);
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
   * @property {string} [domManipulationOrder] - Indicates the order which the dom should be render.
   * @property {boolean} [alternateDOMFlow] - By default true. Entering is top down and leaving is bottom up.
   * @property {boolean} [applyClassListAfterRender] - Indicates whether classlist applies after the render.
   */

  /**
   *
   * @type {RenderConfig}
   */
  ViewNode.GLOBAL_RENDER_CONFIG = {
    // domManipulationOrder: 'alternate',
    alternateDOMFlow: true,
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
    } else if (schemas) {
      __node__.value = null;
      defProp(schemas, '__node__', __node__);
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
      remove.renderingFlow.truncate();
      remove.destroy(sequence, root);
    }
  };

  /**
   *
   * @param schema
   * @param {Node|Element} node
   * @constructor
   * @memberOf Galaxy.View
   */
  function ViewNode(schema, node, refNode) {
    const _this = this;
    /** @type {Node|Element|*} */
    _this.node = node || createElem(schema.tag || 'div');
    _this.refNode = refNode || _this.node;
    _this.schema = schema;
    _this.data = {};
    _this.cache = {};
    _this.localPropertyNames = new Set();
    _this.inputs = {};
    _this.virtual = false;
    _this.placeholder = createComment(schema.tag || 'div');
    _this.properties = [];
    _this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    _this.setters = {};
    _this.parent = null;
    _this.dependedObjects = [];
    _this.renderingFlow = new Galaxy.Sequence();
    _this.sequences = {
      enter: new Galaxy.Sequence(),
      leave: new Galaxy.Sequence(),
      destroy: new Galaxy.Sequence(),
      classList: new Galaxy.Sequence()
    };
    _this.observer = new Galaxy.Observer(_this);
    _this.origin = false;
    _this.transitory = false;

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
    this.schema.renderConfig = Object.assign({}, ViewNode.GLOBAL_RENDER_CONFIG, schema.renderConfig || {});

    __node__.value = this.node;
    defProp(this.schema, '__node__', __node__);

    referenceToThis.value = this;
    defProp(this.node, 'galaxyViewNode', referenceToThis);
    defProp(this.placeholder, 'galaxyViewNode', referenceToThis);

    _this.callLifecycleEvent('postCreate');
  }

  ViewNode.prototype.querySelector = function (selectors) {
    return this.node.querySelector(selectors);
  };

  /**
   *
   * @param {string} id event id
   */
  ViewNode.prototype.callLifecycleEvent = function (id) {
    const lifecycle = this.schema.lifecycle;
    if (lifecycle && typeof lifecycle[id] === 'function') {
      lifecycle[id].call(this, this.inputs, this.data, this.sequences);
    }
  };

  ViewNode.prototype.broadcast = function (event) {
    this.node.dispatchEvent(event);
  };

  ViewNode.prototype.cloneSchema = function () {
    const schemaClone = Object.assign({}, this.schema);
    ViewNode.cleanReferenceNode(schemaClone);

    defProp(schemaClone, 'mother', {
      value: this.schema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return schemaClone;
  };

  ViewNode.prototype.virtualize = function () {
    this.placeholder.nodeValue = JSON.stringify(this.schema, null, 2);
    // this.placeholder.nodeValue = 'tag: ' + this.schema.tag;
    this.virtual = true;
    this.setInDOM(false);
  };

  /**
   *
   * @param {Galaxy.Sequence} sequence
   */
  ViewNode.prototype.populateEnterSequence = function (sequence) {
  };

  /**
   *
   * @param {Galaxy.Sequence} sequence
   */
  ViewNode.prototype.populateLeaveSequence = function (sequence) {

  };

  /**
   *
   * @param {boolean} flag
   */
  ViewNode.prototype.setInDOM = function (flag) {
    let _this = this;
    _this.inDOM = flag;

    // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
    if (flag && !_this.virtual) {
      _this.sequences.leave.truncate();
      _this.callLifecycleEvent('preInsert');

      // remove the animation from the parent which are referring to this node
      _this.sequences.enter.onTruncate(function () {
        _this.parent.sequences.enter.removeByRef(_this.refNode);
      });

      _this.sequences.enter.nextAction(function () {
        if (!_this.node.parentNode) {
          insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          removeChild(_this.placeholder.parentNode, _this.placeholder);
        }

        _this.callLifecycleEvent('postInsert');
        _this.hasBeenInserted();
      });

      let animationDone;
      const waitForNodeAnimation = new Promise(function (resolve) {
        animationDone = resolve;
      });

      _this.parent.sequences.enter.next(function (next) {
        waitForNodeAnimation.then(next);
      }, _this.refNode);

      _this.populateEnterSequence(_this.sequences.enter);
      // Go to next dom manipulation step when the whole :enter sequence is done
      _this.sequences.enter.nextAction(function () {
        _this.callLifecycleEvent('postEnter');
        _this.callLifecycleEvent('postAnimations');
        animationDone();
      });
    } else if (!flag && _this.node.parentNode) {
      _this.sequences.enter.truncate();
      _this.callLifecycleEvent('preRemove');

      // remove the animation from the parent which are referring to this node
      _this.sequences.leave.onTruncate(function () {
        _this.parent.sequences.leave.removeByRef(_this.refNode);
      });

      _this.origin = true;
      // _this.transitory = true;

      let animationDone;
      const waitForNodeAnimation = new Promise(function (resolve) {
        animationDone = resolve;
      });

      _this.parent.sequences.leave.next(function (next) {
        waitForNodeAnimation.then(next);
      }, _this.refNode);

      _this.populateLeaveSequence(_this.sequences.leave);
      // Start the :leave sequence and go to next dom manipulation step when the whole sequence is done
      _this.sequences.leave.nextAction(function () {
        if (!_this.placeholder.parentNode) {
          insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
        }
        _this.callLifecycleEvent('postLeave');

        if (_this.node.parentNode) {
          removeChild(_this.node.parentNode, _this.node);
        }
        _this.callLifecycleEvent('postRemove');

        _this.node.style.cssText = '';
        _this.origin = false;
        _this.callLifecycleEvent('postAnimations');
        animationDone();
      });
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} childNode
   * @param position
   */
  ViewNode.prototype.registerChild = function (childNode, position) {
    const _this = this;
    childNode.parent = _this;

    if (_this.contentRef) {
      _this.contentRef.insertBefore(childNode.placeholder, position);
    } else {
      _this.node.insertBefore(childNode.placeholder, position);
    }
  };

  /**
   * @param {Galaxy.View.ReactiveData} reactiveData
   * @param {string} propertyName
   * @param {Function} expression
   */
  ViewNode.prototype.installSetter = function (reactiveData, propertyName, expression) {
    const _this = this;
    _this.registerProperty(reactiveData);

    _this.setters[propertyName] = GV.createSetter(_this, propertyName, reactiveData, expression);
    if (!_this.setters[propertyName]) {
      _this.setters[propertyName] = function () {
        console.error('No setter for property :', propertyName, '\nNode:', _this);
      };
    }
  };

  /**
   *
   * @param {Galaxy.View.ReactiveData} reactiveData
   */
  ViewNode.prototype.registerProperty = function (reactiveData) {
    if (this.properties.indexOf(reactiveData) === -1) {
      this.properties.push(reactiveData);
    }
  };

  /**
   *
   * @param {Galaxy.Sequence} leaveSequence
   * @param {Galaxy.Sequence} root
   */
  ViewNode.prototype.destroy = function (leaveSequence, root) {
    const _this = this;
    _this.transitory = true;
    // The node is the original node that is being removed
    if (!leaveSequence) {
      _this.origin = true;
      if (_this.inDOM) {
        _this.sequences.enter.truncate();
        _this.callLifecycleEvent('preDestroy');

        // remove the animation from the parent which are referring to this node
        _this.sequences.leave.onTruncate(function () {
          _this.parent.sequences.leave.removeByRef(_this);
        });

        let animationDone;
        const waitForNodeAnimation = new Promise(function (resolve) {
          animationDone = resolve;
        });

        _this.parent.sequences.leave.next(function (next) {
          waitForNodeAnimation.then(function () {
            _this.hasBeenDestroyed();
            next();
          });
        }, _this);

        // Add children leave sequence to this node(parent node) leave sequence
        _this.clean(_this.sequences.leave, root);
        _this.populateLeaveSequence(_this.sequences.leave);
        _this.sequences.leave.nextAction(function () {
          if (_this.schema.renderConfig && _this.schema.renderConfig.domManipulationOrder === 'cascade') {
            root.nextAction(function () {
              removeChild(_this.node.parentNode, _this.node);
            });
          } else {
            removeChild(_this.node.parentNode, _this.node);
          }

          _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
          _this.callLifecycleEvent('postRemove');
          _this.callLifecycleEvent('postDestroy');
          animationDone();
          _this.node.style.cssText = '';
          _this.origin = false;
        }, _this);
      }
    } else if (leaveSequence) {
      if (_this.inDOM) {
        _this.sequences.enter.truncate();
        _this.callLifecycleEvent('preDestroy');

        _this.clean(_this.sequences.leave, root);
        _this.populateLeaveSequence(_this.sequences.leave);

        let animationDone;
        const waitForNodeAnimation = new Promise(function (resolve) {
          animationDone = resolve;
        });

        leaveSequence.next(function (next) {
          waitForNodeAnimation.then(function () {
            _this.hasBeenDestroyed();
            next();
          });
        });

        _this.sequences.leave.nextAction(function () {
          _this.callLifecycleEvent('postRemove');
          _this.callLifecycleEvent('postDestroy');
          _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
          animationDone();
          _this.node.style.cssText = '';
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
    _this.schema.__node__ = undefined;
    _this.inputs = {};
  };

  /**
   *
   * @param {Galaxy.View.ReactiveData} reactiveData
   * @param {Object} item
   */
  ViewNode.prototype.addDependedObject = function (reactiveData, item) {
    this.dependedObjects.push({ reactiveData: reactiveData, item: item });
  };

  /**
   *
   * @param {Galaxy.Sequence} leaveSequence
   * @param {Galaxy.Sequence} root
   * @return {Galaxy.Sequence}
   */
  ViewNode.prototype.clean = function (leaveSequence, root) {
    const _this = this;
    const toBeRemoved = [];
    let node;

    const cn = Array.prototype.slice.call(_this.node.childNodes, 0);
    for (let i = cn.length - 1; i >= 0; i--) {
      node = cn[i]['galaxyViewNode'];

      if (node !== undefined) {
        toBeRemoved.push(node);
      }
    }

    if (_this.schema.renderConfig && _this.schema.renderConfig.domManipulationOrder === 'cascade') {
      toBeRemoved.reverse().forEach(function (node) {
        // Inherit parent domManipulationOrder if no explicit domManipulationOrder is specified
        if (!node.schema.renderConfig.hasOwnProperty('domManipulationOrder')) {
          node.schema.renderConfig.domManipulationOrder = 'cascade';
        }
      });
    }
    // If leaveSequence is present we assume that this is being destroyed as a child, therefore its
    // children should also get destroyed as child
    if (leaveSequence) {
      ViewNode.destroyNodes(_this, toBeRemoved, leaveSequence, root);
      return _this.renderingFlow;
    }

    _this.renderingFlow.next(function (next) {
      if (!toBeRemoved.length) {
        next();
        return _this.renderingFlow;
      }

      ViewNode.destroyNodes(_this, toBeRemoved, null, root || _this.sequences.leave);

      _this.sequences.leave.nextAction(function () {
        _this.callLifecycleEvent('postClean');
        next();
      });
    });

    return _this.renderingFlow;
  };

  /**
   *
   * @returns {*}
   */
  ViewNode.prototype.getPlaceholder = function () {
    if (this.inDOM) {
      return this.node;
    }

    return this.placeholder;
  };

  /**
   *
   * @param {string} name
   * @param value
   * @param oldValue
   */
  ViewNode.prototype.notifyObserver = function (name, value, oldValue) {
    this.observer.notify(name, value, oldValue);
  };

  return ViewNode;

})(Galaxy.View);
