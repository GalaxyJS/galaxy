/* global Galaxy, Promise */
'use strict';

(function (GV) {
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

  /**
   *
   * @type {Galaxy.GalaxyView.ViewNode}
   */
  GV.ViewNode = ViewNode;

  GV.NODE_SCHEMA_PROPERTY_MAP['node'] = {
    type: 'none'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['lifeCycle'] = {
    type: 'prop',
    name: 'lifeCycle'
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

  ViewNode.destroyNodes = function (node, toBeRemoved, sequence) {
    node.domManipulationBus = node.parent.domManipulationBus;
    let remove = null;
    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      remove.destroy(sequence);
      node.domManipulationBus.push(remove.domManipulationSequence.line);
    }

    Promise.all(node.parent.domManipulationBus).then(function () {
      node.parent.domManipulationBus = [];
      node.domManipulationBus = [];
    });
  };

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param {Node|Element} node
   * @param schema
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ViewNode(root, schema, node) {
    // this.root = root;
    this.node = node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    this.virtual = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    this.behaviors = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
    this.dependedObjects = [];
    this.domManipulationBus = [];
    this.uiManipulationSequence = new Galaxy.GalaxySequence().start();
    this.domManipulationSequence = new Galaxy.GalaxySequence().start();
    this.sequences = {
      ':enter': new Galaxy.GalaxySequence().start(),
      ':leave': new Galaxy.GalaxySequence(),
      ':destroy': new Galaxy.GalaxySequence(),
      ':class': new Galaxy.GalaxySequence().start()
    };
    this.observer = new Galaxy.GalaxyObserver(this);
    this.origin = false;

    let _this = this;
    this.rendered = new Promise(function (ready) {
      _this.ready = ready;
      _this.callLifeCycleEvent('rendered');
    });

    __node__.value = this.node;
    GV.defineProp(this.schema, '__node__', __node__);

    referenceToThis.value = this;
    GV.defineProp(this.node, '__viewNode__', referenceToThis);
    GV.defineProp(this.placeholder, '__viewNode__', referenceToThis);

    this.callLifeCycleEvent('created');
  }

  ViewNode.prototype.callLifeCycleEvent = function (id) {
    if (this.schema.lifeCycle && typeof this.schema.lifeCycle[id] === 'function') {
      this.schema.lifeCycle[id].call(this);
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

  ViewNode.prototype.setInDOM = function (flag, nextUIAction) {
    let _this = this;
    _this.inDOM = flag;

    // We use domManipulationSequence to make sure dom manipulation activities happen in order and don't interfere
    if (flag /*&& !_this.node.parentNode*/ && !_this.virtual) {
      _this.domManipulationSequence.next(function (done) {
        insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        removeChild(_this.placeholder.parentNode, _this.placeholder);
        _this.populateEnterSequence(_this.sequences[':enter']);
        // Go to next dom manipulation step when the whole :enter sequence is done
        _this.sequences[':enter'].nextAction(function () {
          done();
        });
        _this.callLifeCycleEvent('inserted');
      });
    } else if (!flag && _this.node.parentNode) {
      _this.domManipulationSequence.next(function (done) {
        _this.origin = true;
        _this.populateLeaveSequence(_this.sequences[':leave']);
        // Start the :leave sequence and go to next dom manipulation step when the whole sequence is done
        _this.sequences[':leave'].start().finish(function () {
          insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
          removeChild(_this.node.parentNode, _this.node);
          done();
          _this.sequences[':leave'].reset();
          _this.origin = false;
          _this.callLifeCycleEvent('removed');
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
    let _this = this;
    viewNode.parent = _this;

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
    if (exist instanceof Array) {
      exist.push(boundProperty);
    } else if (exist) {
      this.properties[boundProperty.name] = [exist, boundProperty];
    } else {
      this.properties[boundProperty.name] = boundProperty;
    }

    this.setters[propertyName] = GV.getPropertySetter(this, propertyName, this.virtual ? false : expression);
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
        _this.domManipulationSequence.next(function (done) {
          // Add children leave sequence to this node(parent node) leave sequence
          _this.clean(_this.sequences[':leave']);

          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start()
            .finish(function () {
              removeChild(_this.node.parentNode, _this.node);
              done();

              _this.origin = false;

              _this.sequences[':leave'].reset();

              _this.callLifeCycleEvent('removed');
              _this.callLifeCycleEvent('destroyed');
            });
        });
      }
    } else if (leaveSequence) {
      _this.clean(leaveSequence);

      if (_this.inDOM) {
        leaveSequence.nextAction(function () {
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start()
            .finish(function () {
              _this.sequences[':leave'].reset();

              _this.callLifeCycleEvent('removed');
              _this.callLifeCycleEvent('destroyed');
            });
        });
      }
    } else {
      _this.clean(leaveSequence);

      if (_this.inDOM) {
        _this.domManipulationSequence.next(function (done) {
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start()
            .finish(function () {
              removeChild(_this.node.parentNode, _this.node);
              done();

              _this.sequences[':leave'].reset();

              _this.callLifeCycleEvent('removed');
              _this.callLifeCycleEvent('destroyed');
            });
        });
      }
    }

    _this.domManipulationSequence.nextAction(function () {
      _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
    });


    let property, properties = _this.properties;
    // for (let i = 0, len = properties.length; i < len; i++) {
    for (let key in properties) {
      property = properties[key];

      if (property instanceof Array) {
        property.forEach(function (item) {
          item.removeNode(_this);
        });
      } else {
        property.removeNode(_this);
      }
    }

    _this.inDOM = false;
    _this.dependedObjects.forEach(function (item) {
      let temp = GV.getBoundProperties(item);
      temp.forEach(function (property) {
        property.removeNode(item);
      });
    });

    _this.schema.__node__ = undefined;
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
    for (let i = this.node.childNodes.length - 1; i >= 0; i--) {
      node = this.node.childNodes[i];

      if (node.hasOwnProperty('__viewNode__')) {
        toBeRemoved.push(node['__viewNode__']);
      }
    }

    // If leaveSequence is present we assume that this is a being destroyed as child, therefore its
    // children should also get destroyed as child
    if (leaveSequence) {
      ViewNode.destroyNodes(_this, toBeRemoved, leaveSequence);

      return _this.uiManipulationSequence;
    }

    _this.uiManipulationSequence.next(function (nextUIAction) {
      if (!toBeRemoved.length) {
        nextUIAction();
      }

      ViewNode.destroyNodes(_this, toBeRemoved);

      Promise.all(_this.domManipulationBus).then(function () {
        _this.domManipulationBus = [];
        nextUIAction();
      });
    });

    return this.uiManipulationSequence;
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

})(Galaxy.GalaxyView);
