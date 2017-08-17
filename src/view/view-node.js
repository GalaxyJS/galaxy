/* global Galaxy, Promise */
(function (GV) {

  function createElem(t) {
    return document.createElement(t);
  }

  var commentNode = document.createComment('');

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


  var referenceToThis = {
    value: this,
    configurable: false,
    enumerable: false
  };

  var __node__ = {
    value: null,
    configurable: false,
    enumerable: false
  };

  var __behaviors__ = {
    value: {},
    enumerable: false,
    writable: false
  };

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param node
   * @param schema
   * @constructor
   */
  function ViewNode(root, schema, node) {
    this.root = root;
    this.node = node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    // this.mutator = {};
    this.virtual = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    this.values = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.watchers = {};
    this.parent = null;
    this.dependedObjects = [];
    this.domManipulationSequence = new Galaxy.GalaxySequence().start();
    this.sequences = {};

    var _this = this;
    this.rendered = new Promise(function (ready) {
      _this.ready = ready;
    });

    this.createSequence(':enter', true);
    this.createSequence(':leave', false);
    this.createSequence(':destroy', false);
    this.createSequence(':class', true);

    __node__.value = this.node;
    GV.defineProp(this.schema, '__node__', __node__);

    __behaviors__.value = {};
    GV.defineProp(this.properties, '__behaviors__', __behaviors__);

    referenceToThis.value = this;
    GV.defineProp(this.node, '__viewNode__', referenceToThis);
    GV.defineProp(this.placeholder, '__viewNode__', referenceToThis);
  }

  ViewNode.prototype.cloneSchema = function () {
    var clone = Object.assign({}, this.schema);
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

  ViewNode.prototype.setInDOM = function (flag) {
    var _this = this;
    _this.inDOM = flag;
    if (flag /*&& !_this.node.parentNode*/ && !_this.virtual) {
      _this.domManipulationSequence.next(function (done) {
        insertBefore(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        removeChild(_this.placeholder.parentNode, _this.placeholder);
        _this.sequences[':enter'].finish(done);
      });
    } else if (!flag && _this.node.parentNode) {
      _this.domManipulationSequence.next(function (done) {
        _this.sequences[':leave'].start().finish(function () {
          insertBefore(_this.node.parentNode, _this.placeholder, _this.node);
          removeChild(_this.node.parentNode, _this.node);
          done();
          _this.sequences[':leave'].reset();
        });
      });
    }
  };

  ViewNode.prototype.append = function (viewNode, position) {
    var _this = this;
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
      var _this = this;
      this.setters[propertyName] = function () {
        console.error('No setter for property :', propertyName, '\nNode:', _this);
      };
    }
  };

  ViewNode.prototype.destroy = function (sequence, source) {
    var _this = this;

    if (!source) {
      if (_this.inDOM) {
        _this.domManipulationSequence.next(function (done) {
          _this.empty(_this.sequences[':destroy'], true);
          _this.sequences[':destroy'].start().finish(function () {
            _this.sequences[':leave'].start().finish(function () {
              removeChild(_this.node.parentNode, _this.node);
              _this.sequences[':leave'].reset();
            });

            done();
            _this.sequences[':destroy'].reset();
          });
        });
      }
    } else if (source) {
      if (_this.inDOM) {
        sequence.next(function (done) {
          _this.sequences[':leave'].start().finish(function () {
            _this.sequences[':leave'].reset();
          });

          done();
        });
      }

      _this.empty(sequence, true);
    } else {
      if (_this.inDOM) {
        _this.domManipulationSequence.next(function (done) {
          _this.sequences[':leave'].start().finish(function () {
            removeChild(_this.node.parentNode, _this.node);
            done();
            _this.sequences[':leave'].reset();
          });
        });
      }
      _this.empty(sequence, true);
    }

    _this.domManipulationSequence.next(function (done) {
      _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);
      done();
    });


    var property, properties = _this.properties;

    for (var propertyName in properties) {
      property = properties[propertyName];
      property.removeNode(_this);
    }

    _this.inDOM = false;
    _this.dependedObjects.forEach(function (item) {
      var temp = GV.getBoundProperties(item);
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
    var property;
    for (var propertyName in this.properties) {
      property = this.properties[propertyName];
      if (property.nodes.indexOf(this) === -1) {
        property.nodes.push(this);
        property.props.push(propertyName);
      }
    }
  };

  var empty = function (nodes) {
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
    var toBeRemoved = [], node;
    for (var i = this.node.childNodes.length - 1, till = 0; i >= till; i--) {
      node = this.node.childNodes[i];

      if (node.hasOwnProperty('__viewNode__')) {
        toBeRemoved.push(node.__viewNode__);
      }
    }

    var domManipulationSequence;

    toBeRemoved.forEach(function (viewNode) {
      viewNode.destroy(sequence, source);
      domManipulationSequence = viewNode.domManipulationSequence;
    });


    return domManipulationSequence || this.domManipulationSequence;
  };

  ViewNode.prototype.getPlaceholder = function () {
    if (this.inDOM) {
      return this.node;
    }

    return this.placeholder;
  };

  ViewNode.prototype.watch = function (name, callback) {
    this.watchers[name] = callback.bind(this);
  };

  ViewNode.prototype.callWatchers = function (name, value, oldValue) {
    if (this.watchers.hasOwnProperty(name)) {
      this.watchers[name](value, oldValue);
    }
  };

})(Galaxy.GalaxyView);
