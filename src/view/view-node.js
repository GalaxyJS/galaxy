/* global Galaxy, Promise */
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

  /**
   *
   * @returns {Galaxy.GalaxyView.ViewNode}
   */
  GV.ViewNode = ViewNode;

  GV.NODE_SCHEMA_PROPERTY_MAP['node'] = {
    type: 'none'
  };


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

  GV.NODE_SCHEMA_PROPERTY_MAP['lifeCycle'] = {
    type: 'prop',
    name: 'lifeCycle'
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['renderConfig'] = {
    type: 'prop',
    name: 'renderConfig'
  };

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param node
   * @param schema
   * @constructor
   */
  function ViewNode(root, schema, node,dms) {
    this.root = root;
    this.node = node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    this.virtual = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {
      behaviors: {}
    };
    this.values = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
    this.dependedObjects = [];
    this.domManipulationSequence = new Galaxy.GalaxySequence().start();
    this.sequences = {};
    this.observer = new Galaxy.GalaxyObserver(this);
    this.origin = false;

    let _this = this;
    this.rendered = new Promise(function (ready) {
      _this.ready = ready;
      _this.callLifeCycleEvent('rendered');
    });

    this.createSequence(':enter', true);
    this.createSequence(':leave', false);
    this.createSequence(':destroy', false);
    this.createSequence(':class', true);

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

  ViewNode.prototype.cloneSchema = function () {
    let clone = Object.assign({}, this.schema);
    empty(clone);

    GV.defineProp(clone, 'mother', {
      value: this.schema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return clone;
  };

  /**
   *
   * @param name
   * @param start
   * @returns {Galaxy.GalaxySequence}
   */
  ViewNode.prototype.createSequence = function (name, start) {
    if (!this.sequences[name]) {
      this.sequences[name] = new Galaxy.GalaxySequence();

      if (start) {
        this.sequences[name].start();
      }
    }

    return this.sequences[name];
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

  ViewNode.prototype.setInDOM = function (flag) {
    let _this = this;
    _this.inDOM = flag;
    // domManipulationSequence = domManipulationSequence || _this.domManipulationSequence;

    // We use domManipulationSequence to make sure dom manipulation activities happen in oder and don't interfere
    if (flag /*&& !_this.node.parentNode*/ && !_this.virtual) {
      _this.domManipulationSequence.next(function (done) {
        insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        removeChild(_this.placeholder.parentNode, _this.placeholder);
        _this.populateEnterSequence(_this.sequences[':enter']);
        // Go to next dom manipulation step when the whole :enter sequence is done
        _this.sequences[':enter'].finish(done);
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
    this.properties[boundProperty.name] = boundProperty;
    this.setters[propertyName] = this.root.getPropertySetter(this, propertyName, this.virtual ? null : expression);
    if (!this.setters[propertyName]) {
      let _this = this;
      this.setters[propertyName] = function () {
        console.error('No setter for property :', propertyName, '\nNode:', _this);
      };
    }
  };

  ViewNode.prototype.destroy = function (sequence, source) {
    let _this = this;

    if (!source) {
      _this.origin = true;
      if (_this.inDOM) {
        _this.domManipulationSequence.next(function (done) {
          // _this.empty(_this.sequences[':destroy'], true);
          // _this.sequences[':destroy'].start().finish(function ()

          // Add children leave sequence to this node leave sequence
          _this.empty(_this.sequences[':leave'], true);
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start().finish(function () {
            removeChild(_this.node.parentNode, _this.node);
            _this.sequences[':leave'].reset();
            done();
            _this.origin = false;
            _this.callLifeCycleEvent('removed');
            _this.callLifeCycleEvent('destroyed');
          });


          // _this.sequences[':destroy'].reset();
          // _this.callLifeCycleEvent('destroyed');
          // });
        });
      }
    } else if (source) {
      if (_this.inDOM) {
        sequence.next(function (done) {
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start().finish(function () {
            _this.sequences[':leave'].reset();
            _this.callLifeCycleEvent('removed');
            _this.callLifeCycleEvent('destroyed');
          });

          done();
        });
      }

      _this.empty(sequence, true);
    } else {
      if (_this.inDOM) {
        _this.domManipulationSequence.next(function (done) {
          _this.populateLeaveSequence(_this.sequences[':leave']);
          _this.sequences[':leave'].start().finish(function () {
            removeChild(_this.node.parentNode, _this.node);
            done();
            _this.sequences[':leave'].reset();
            _this.callLifeCycleEvent('removed');
            _this.callLifeCycleEvent('destroyed');
          });
        });
      }
      _this.empty(sequence, true);
    }

    _this.domManipulationSequence.next(function (done) {
      _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
      done();
    });


    let property, properties = _this.properties;

    for (let propertyName in properties) {
      property = properties[propertyName];

      if (property instanceof GV.BoundProperty) {
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
  };

  ViewNode.prototype.addDependedObject = function (item) {
    if (this.dependedObjects.indexOf(item) === -1) {
      this.dependedObjects.push(item);
    }
  };

  ViewNode.prototype.refreshBinds = function (data) {
    let property;
    for (let propertyName in this.properties) {
      property = this.properties[propertyName];
      if (property.nodes.indexOf(this) === -1) {
        property.nodes.push(this);
        property.props.push(propertyName);
      }
    }
  };

  const empty = function (nodes) {
    if (nodes instanceof Array) {
      nodes.forEach(function (node) {
        empty(node);
      });
    } else if (nodes) {
      nodes.__node__ = null;
      empty(nodes.children);
    }
  };

  ViewNode.prototype.empty = function (sequence, source) {
    let toBeRemoved = [], node;
    for (let i = this.node.childNodes.length - 1, till = 0; i >= till; i--) {
      node = this.node.childNodes[i];

      if (node.hasOwnProperty('__viewNode__')) {
        toBeRemoved.push(node.__viewNode__);
      }
    }

    let domManipulationSequence = this.domManipulationSequence;
    // sequence = sequence || this.domManipulationSequence
    toBeRemoved.forEach(function (viewNode) {
      viewNode.destroy(sequence, source);
      // if(viewNode.origin)
      domManipulationSequence = viewNode.domManipulationSequence;
    });


    return domManipulationSequence;
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
