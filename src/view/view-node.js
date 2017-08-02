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
    /**
     *
     * @public
     * @type {Galaxy.GalaxyView}
     */
    this.root = root;
    this.node = node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    this.mutator = {};
    this.virtual = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    this.values = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
    this.dependedObjects = [];
    this.domManipulationSequence = new Galaxy.GalaxySequence().start();
    this.sequences = {};

    var _this = this;
    this.onReady = new Promise(function (ready) {
      _this.ready = ready;
    });

    this.createSequence(':enter', true);
    this.createSequence(':leave', false);
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
    if (flag && !_this.node.parentNode && !_this.virtual) {
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
   * @param {Galaxy.GalaxyView.BoundProperty} property
   */
  ViewNode.prototype.addProperty = function (property, attributeName) {
    this.properties[property.name] = property;
    this.setters[attributeName] = this.root.getPropertySetter(this, attributeName);
    if (!this.setters[attributeName]) {
      var _this = this;
      this.setters[attributeName] = function () {
        console.error('No setter for property :', attributeName, '\nNode:', _this);
      };
    }
  };

  ViewNode.prototype.destroy = function () {
    var _this = this;

    if (_this.inDOM) {
      _this.domManipulationSequence.next(function (done) {
        _this.sequences[':leave'].start().finish(function () {
          removeChild(_this.node.parentNode, _this.node);
          done();
          _this.sequences[':leave'].reset();
        });
      });
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
    this.dependedObjects.forEach(function (item) {
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

  ViewNode.prototype.empty = function () {
    var toBeRemoved = [], node, _this = this;
    for (var i = 0, len = this.node.childNodes.length; i < len; i++) {
      node = this.node.childNodes[i];

      if (node.hasOwnProperty('__viewNode__')) {
        toBeRemoved.push(node.__viewNode__);
      }

      toBeRemoved = toBeRemoved.concat(GV.getAllViewNodes(node));
    }

    var domManipulationSequence = this.domManipulationSequence;
    toBeRemoved.forEach(function (viewNode) {
      console.info(viewNode.node);
      if (viewNode.parent === _this) {
        domManipulationSequence = viewNode.domManipulationSequence;
        viewNode.destroy();
      } else if (viewNode.parent) {
        domManipulationSequence.next(function (done) {
          viewNode.destroy();
          done();
        });
      } else {
        viewNode.destroy();
      }
    });
  };

  ViewNode.prototype.getPlaceholder = function () {
    if (this.inDOM) {
      return this.node;
    }

    return this.placeholder;
  };

})(Galaxy.GalaxyView);
