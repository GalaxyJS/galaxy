/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxyView.ViewNode = /** @class */ (function (GV) {
  function createElem(t) {
    return document.createElement(t);
  }

  let commentNode = document.createComment('');

  function createComment(t) {
    return commentNode.cloneNode(t);
  }

  function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  }

  function removeChild(node, child) {
    node.removeChild(child);
  }

  const defineProp = Object.defineProperty;

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

  ViewNode.cleanReferenceNode = function (schemas) {
    if (schemas instanceof Array) {
      schemas.forEach(function (node) {
        ViewNode.cleanReferenceNode(node);
      });
    } else if (schemas) {
      __node__.value = null;
      defineProp(schemas, '__node__', __node__);
      ViewNode.cleanReferenceNode(schemas.children);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {Array} toBeRemoved
   * @param {Galaxy.GalaxySequence} sequence
   * @param {Galaxy.GalaxySequence} root
   * @memberOf Galaxy.GalaxyView.ViewNode
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
   * @param {Galaxy.GalaxyView} root
   * @param schema
   * @param {Node|Element} node
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ViewNode(schema, node) {
    const _this = this;
    _this.node = node || createElem(schema.tag || 'div');
    _this.schema = schema;
    _this.data = {};
    _this.cache = {};
    // _this.addons = {};
    _this.inputs = {};
    // _this.localScope = {};
    _this.virtual = false;
    _this.placeholder = createComment(schema.tag || 'div');
    _this.properties = [];
    // _this.behaviors = {};
    _this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    _this.setters = {};
    _this.parent = null;
    _this.dependedObjects = [];
    // _this.domBus = [];
    _this.renderingFlow = new Galaxy.GalaxySequence();
    // _this.domManipulationSequence = new Galaxy.GalaxySequence();
    _this.sequences = {
      enter: new Galaxy.GalaxySequence(),
      leave: new Galaxy.GalaxySequence(),
      ':destroy': new Galaxy.GalaxySequence(true),
      ':class': new Galaxy.GalaxySequence().start()
    };
    _this.observer = new Galaxy.GalaxyObserver(_this);
    _this.origin = false;

    _this.hasBeenRendered = null;
    _this.rendered = new Promise(function (done) {
      _this.hasBeenRendered = function () {
        _this.rendered.resolved = true;
        done();
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

    __node__.value = this.node;
    defineProp(this.schema, '__node__', __node__);

    referenceToThis.value = this;
    defineProp(this.node, '__viewNode__', referenceToThis);
    defineProp(this.placeholder, '__viewNode__', referenceToThis);

    _this.callLifecycleEvent('postCreate');
  }

  /**
   *
   * @param {string} id event id
   */
  ViewNode.prototype.callLifecycleEvent = function (id) {
    if (this.schema.lifecycle && typeof this.schema.lifecycle[id] === 'function') {
      this.schema.lifecycle[id].call(this, this.inputs, this.data, this.sequences);
    }
  };

  ViewNode.prototype.broadcast = function (event) {
    this.node.dispatchEvent(event);
  };

  ViewNode.prototype.cloneSchema = function () {
    const schemaClone = Object.assign({}, this.schema);
    ViewNode.cleanReferenceNode(schemaClone);

    GV.defineProp(schemaClone, 'mother', {
      value: this.schema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return schemaClone;
  };

  ViewNode.prototype.virtualize = function () {
    this.placeholder.nodeValue = JSON.stringify(this.schema, null, 2);
    this.virtual = true;
    this.setInDOM(false);
  };

  ViewNode.prototype.populateEnterSequence = function (sequence) {
    this.node.style.visibility = '';
  };

  ViewNode.prototype.populateLeaveSequence = function (sequence) {

  };

  ViewNode.prototype.setInDOM = function (flag) {
    let _this = this;
    _this.inDOM = flag;

    // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
    if (flag /*&& !_this.node.parentNode*/ && !_this.virtual) {
      _this.sequences.leave.truncate();
      _this.callLifecycleEvent('preInsert');

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
      });

      _this.populateEnterSequence(_this.sequences.enter);
      // Go to next dom manipulation step when the whole :enter sequence is done
      _this.sequences.enter.nextAction(animationDone);
    } else if (!flag && _this.node.parentNode) {
      _this.sequences.enter.truncate();
      _this.callLifecycleEvent('preRemove');

      _this.origin = true;

      let animationDone;
      const waitForNodeAnimation = new Promise(function (resolve) {
        animationDone = resolve;
      });

      _this.parent.sequences.leave.next(function (next) {
        waitForNodeAnimation.then(next);
      });

      _this.populateLeaveSequence(_this.sequences.leave);
      // Start the :leave sequence and go to next dom manipulation step when the whole sequence is done
      _this.sequences.leave.nextAction(function () {
        if (!_this.placeholder.parentNode) {
          insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
        }

        if (_this.node.parentNode) {
          removeChild(_this.node.parentNode, _this.node);
        }

        _this.origin = false;
        _this.callLifecycleEvent('postRemove');
        animationDone();
      });
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} viewNode
   * @param position
   */
  ViewNode.prototype.registerChild = function (viewNode, position) {
    const _this = this;
    viewNode.parent = _this;
    _this.node.insertBefore(viewNode.placeholder, position);
  };

  /**
   * @param {Galaxy.GalaxyView.ReactiveData} reactiveData
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
   * @param {Galaxy.GalaxyView.ReactiveData} reactiveData
   */
  ViewNode.prototype.registerProperty = function (reactiveData) {
    if (this.properties.indexOf(reactiveData) === -1) {
      this.properties.push(reactiveData);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxySequence} leaveSequence
   * @param {Galaxy.GalaxySequence} root
   */
  ViewNode.prototype.destroy = function (leaveSequence, root) {
    const _this = this;

    // The node is the original node that is being removed
    if (!leaveSequence) {
      _this.origin = true;
      if (_this.inDOM) {
        _this.sequences.enter.truncate();
        _this.callLifecycleEvent('preDestroy');

        let animationDone;
        const waitForNodeAnimation = new Promise(function (resolve) {
          animationDone = resolve;
        });

        _this.parent.sequences.leave.next(function (next) {
          waitForNodeAnimation.then(function () {
            _this.hasBeenDestroyed();
            next();
          });
        });

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
          _this.origin = false;
        });
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
    _this.inDOM = false;
    _this.schema.__node__ = undefined;
    _this.inputs = {};
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveData} reactiveData
   * @param {Object} item
   */
  ViewNode.prototype.addDependedObject = function (reactiveData, item) {
    this.dependedObjects.push({ reactiveData: reactiveData, item: item });
  };

  ViewNode.prototype.clean = function (leaveSequence, root) {
    let toBeRemoved = [], node, _this = this;

    const cn = Array.prototype.slice.call(_this.node.childNodes, 0);
    for (let i = cn.length - 1; i >= 0; i--) {
      node = cn[i]['__viewNode__'];

      if (node !== undefined) {
        toBeRemoved.push(node);
      }
    }

    if (_this.schema.renderConfig && _this.schema.renderConfig.domManipulationOrder === 'cascade') {
      toBeRemoved.reverse().forEach(function (node) {
        node.schema.renderConfig = node.schema.renderConfig || {};
        node.schema.renderConfig.domManipulationOrder = 'cascade';
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

  ViewNode.prototype.notifyObserver = function (name, value, oldValue) {
    this.observer.notify(name, value, oldValue);
  };

  return ViewNode;

})(Galaxy.GalaxyView);
