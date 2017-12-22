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

  let referenceToThis = {
    value: this,
    configurable: false,
    enumerable: false
  };

  let __node__ = {
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
      schemas.__node__ = null;
      ViewNode.cleanReferenceNode(schemas.children);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {Array} toBeRemoved
   * @param {Galaxy.GalaxySequence} sequence
   * @memberOf Galaxy.GalaxyView.ViewNode
   * @static
   */
  ViewNode.destroyNodes = function (node, toBeRemoved, sequence) {
    node.domBus = node.parent.domBus;
    let remove = null;
    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      remove.destroy(sequence);
      node.domBus.push(remove.domManipulationSequence.line);
    }

    setTimeout(function () {
      Promise.all(node.parent.domBus).then(function () {
        node.parent.domBus = [];
        node.domBus = [];
      });
    });
  };

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param {Node|Element} node
   * @param schema
   * @param {null|Object} localScope
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ViewNode(root, schema, node) {
    // this.root = root;
    this.node = node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    this.addons = {};
    this.inputs = {};
    this.localScope = {};
    this.virtual = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    this.behaviors = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
    this.dependedObjects = [];
    this.domBus = [];
    this.renderingFlow = new Galaxy.GalaxySequence(true).start();
    this.domManipulationSequence = new Galaxy.GalaxySequence(true).start();
    this.sequences = {
      ':enter': new Galaxy.GalaxySequence(true).start(),
      ':leave': new Galaxy.GalaxySequence(true).start(),
      ':destroy': new Galaxy.GalaxySequence(true),
      ':class': new Galaxy.GalaxySequence().start()
    };
    this.observer = new Galaxy.GalaxyObserver(this);
    this.origin = false;

    let _this = this;
    this.rendered = new Promise(function (ready) {
      _this.ready = ready;
      _this.callLifecycleEvent('rendered');
    });

    __node__.value = this.node;
    GV.defineProp(this.schema, '__node__', __node__);

    referenceToThis.value = this;
    GV.defineProp(this.node, '__viewNode__', referenceToThis);
    GV.defineProp(this.placeholder, '__viewNode__', referenceToThis);

    this.callLifecycleEvent('postCreate');
  }

  /**
   *
   * @param {string} id event id
   */
  ViewNode.prototype.callLifecycleEvent = function (id) {
    if (this.schema.lifecycle && typeof this.schema.lifecycle[id] === 'function') {
      this.schema.lifecycle[id].call(this, this.inputs, this.localScope, this.domManipulationSequence);
    }
  };

  ViewNode.prototype.broadcast = function (event) {
    this.node.dispatchEvent(event);
  };

  ViewNode.prototype.cloneSchema = function () {
    let schemaClone = Object.assign({}, this.schema);
    ViewNode.cleanReferenceNode(schemaClone);

    GV.defineProp(schemaClone, 'mother', {
      value: this.schema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return schemaClone;
  };

  ViewNode.prototype.toTemplate = function () {
    this.placeholder.nodeValue = JSON.stringify(this.schema, null, 2);
    this.virtual = true;
    this.setInDOM(false);
  };

  ViewNode.prototype.populateEnterSequence = function (sequence) {

  };

  ViewNode.prototype.populateLeaveSequence = function (sequence) {

  };

  /**
   *
   * @param {Promise} promise
   */
  ViewNode.prototype.addToDOMBus = function (promise) {
    this.domBus.push(promise);
  };

  ViewNode.prototype.setInDOM = function (flag) {
    let _this = this;
    _this.inDOM = flag;

    // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
    if (flag /*&& !_this.node.parentNode*/ && !_this.virtual) {
      _this.callLifecycleEvent('preInsert');
      _this.domManipulationSequence.next(function (done) {
        insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        removeChild(_this.placeholder.parentNode, _this.placeholder);
        _this.populateEnterSequence(_this.sequences[':enter']);
        // Go to next dom manipulation step when the whole :enter sequence is done
        _this.sequences[':enter'].nextAction(function () {
          done();
        });
        _this.callLifecycleEvent('postInsert');
      });
    } else if (!flag && _this.node.parentNode) {
      _this.callLifecycleEvent('preRemove');
      _this.domManipulationSequence.next(function (done) {
        _this.origin = true;
        _this.populateLeaveSequence(_this.sequences[':leave']);
        // Start the :leave sequence and go to next dom manipulation step when the whole sequence is done
        _this.sequences[':leave'].nextAction(function () {
          insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
          removeChild(_this.node.parentNode, _this.node);
          done();
          // _this.sequences[':leave'].reset();
          _this.origin = false;
          _this.callLifecycleEvent('postRemove');
        });
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
    viewNode.domBus = _this.domBus;
    _this.node.insertBefore(viewNode.placeholder, position);
  };

  /**
   *
   * @param {Galaxy.GalaxyView.BoundProperty} boundProperty
   * @param {string} propertyName
   * @param {Function} expression
   */
  ViewNode.prototype.installPropertySetter = function (boundProperty, propertyName, expression) {
    // This cause memory leak for expressions
    let exist = this.properties[boundProperty.name];
    if (exist) {
      if (exist.indexOf(boundProperty) === -1) {
        exist.push(boundProperty);
      }
    } else {
      this.properties[boundProperty.name] = [boundProperty];
    }

    this.setters[propertyName] = GV.getPropertySetter(this, propertyName, /*this.virtual ? false :*/ expression);
    if (!this.setters[propertyName]) {
      let _this = this;
      this.setters[propertyName] = function () {
        console.error('No setter for property :', propertyName, '\nNode:', _this);
      };
    }
  };

  /**
   *
   * @param {Galaxy.GalaxySequence}
   */
  ViewNode.prototype.destroy = function (leaveSequence) {
    const _this = this;

    // The node is the original node that is being removed
    if (!leaveSequence) {
      _this.origin = true;
      if (_this.inDOM) {
        _this.callLifecycleEvent('preDestroy');
        _this.domManipulationSequence.next(function (done) {
          // Add children leave sequence to this node(parent node) leave sequence
          _this.clean(_this.sequences[':leave']);
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave']
            .nextAction(function () {
              removeChild(_this.node.parentNode, _this.node);
              done();
              _this.origin = false;
              // _this.sequences[':leave'].reset();
              _this.callLifecycleEvent('postRemove');
              _this.callLifecycleEvent('postDestroy');
            });
        });
      }
    } else if (leaveSequence) {
      _this.clean(leaveSequence);

      if (_this.inDOM) {
        _this.callLifecycleEvent('preDestroy');
        leaveSequence.next(function (next) {
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave']
            .nextAction(function () {
              // _this.sequences[':leave'].reset();
              _this.callLifecycleEvent('postRemove');
              _this.callLifecycleEvent('postDestroy');
              next();
            });
        });
      }
    }

    _this.domManipulationSequence.nextAction(function () {
      _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
    });

    let property, properties = _this.properties;
    const removeItem = function (item) {
      item.removeNode(_this);
    };

    for (let key in properties) {
      property = properties[key];
      property.forEach(removeItem);
    }

    _this.dependedObjects.forEach(function (item) {
      let temp = GV.getBoundProperties(item);
      temp.forEach(function (property) {
        property.removeNode(item);
      });
    });

    _this.inDOM = false;
    _this.schema.__node__ = undefined;
    _this.inputs = {};
  };

  ViewNode.prototype.addDependedObject = function (item) {
    if (this.dependedObjects.indexOf(item) === -1) {
      this.dependedObjects.push(item);
    }
  };

  ViewNode.prototype.refreshBinds = function () {
    let property, properties = this.properties;
    for (let key in properties) {
      property = properties[key];

      if (property instanceof Array) {
        property.forEach(function (item) {
          if (item.nodes.indexOf(this) === -1) {
            item.nodes.push(this);
            item.props.push(key);
          }
        });
      } else {
        if (property.value.nodes.indexOf(this) === -1) {
          property.value.nodes.push(this);
          property.value.props.push(key);
        }
      }
    }
  };

  ViewNode.prototype.clean = function (leaveSequence) {
    let toBeRemoved = [], node, _this = this;

    const cn = Array.prototype.slice.call(_this.node.childNodes, 0);
    for (let i = cn.length - 1; i >= 0; i--) {
      node = cn[i]['__viewNode__'];

      if (node !== undefined) {
        toBeRemoved.push(node);
      }
    }

    // If leaveSequence is present we assume that this is being destroyed as a child, therefore its
    // children should also get destroyed as child
    if (leaveSequence) {
      ViewNode.destroyNodes(_this, toBeRemoved, leaveSequence);
      return _this.renderingFlow;
    }

    _this.renderingFlow.next(function (next) {
      if (!toBeRemoved.length) {
        next();
      }

      ViewNode.destroyNodes(_this, toBeRemoved);

      Promise.all(_this.domBus).then(function () {
        _this.domBus = [];
        next();
      });
    });

    return _this.renderingFlow;
  };

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
