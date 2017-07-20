/* global Galaxy */
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


  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param node
   * @param schema
   * @constructor
   */
  function ViewNode(root, schema,node) {
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
    this.template = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    Object.defineProperty(this.properties, '__reactive__', {
      value: {},
      enumerable: false,
      writable: false
    });
    this.values = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
    // this.schema.node = this.node;

    Object.defineProperty(this.schema, '__node__', {
      value: this.node,
      configurable: false,
      enumerable: false
    });

    var referenceToThis = {
      value: this,
      configurable: false,
      enumerable: false
    };

    Object.defineProperty(this.node, '__viewNode__', referenceToThis);
    Object.defineProperty(this.placeholder, '__viewNode__', referenceToThis);
  }

  ViewNode.prototype.cloneSchema = function () {
    var clone = Object.assign({}, this.schema);
    empty(clone);
    clone.node = this.node.cloneNode(false);
    Object.defineProperty(clone, 'mother', {
      value: this.schema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return clone;
  };

  ViewNode.prototype.toTemplate = function () {
    this.placeholder.nodeValue = JSON.stringify(this.schema, null, 2);
    this.template = true;
    this.setInDOM(false);
  };

  ViewNode.prototype.setInDOM = function (flag) {
    this.inDOM = flag;
    if (flag && !this.node.parentNode && !this.template) {
      insertBefore(this.placeholder.parentNode, this.node, this.placeholder.nextSibling);
      removeChild(this.placeholder.parentNode, this.placeholder);
    } else if (!flag && this.node.parentNode) {
      insertBefore(this.node.parentNode, this.placeholder, this.node);
      removeChild(this.node.parentNode, this.node);
    }
  };

  ViewNode.prototype.append = function (viewNode, position) {
    viewNode.parent = this;
    this.node.insertBefore(viewNode.placeholder, position);
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
      removeChild(_this.node.parentNode, _this.node);
    }

    _this.placeholder.parentNode && removeChild(_this.placeholder.parentNode, _this.placeholder);

    var nodeIndexInTheHost, property, properties = _this.properties;

    for (var propertyName in properties) {
      property = properties[propertyName];
      nodeIndexInTheHost = property.nodes.indexOf(_this);
      if (nodeIndexInTheHost !== -1) {
        property.nodes.splice(nodeIndexInTheHost, 1);
        property.props.splice(nodeIndexInTheHost, 1);
      }
    }

    // properties = _this.properties.__reactive__;
    //
    // for (propertyName in properties) {
    //   property = properties[propertyName];
    //   nodeIndexInTheHost = property.nodes ? property.nodes.indexOf(_this) : -1;
    //   if (nodeIndexInTheHost !== -1) {
    //     property.nodes.splice(nodeIndexInTheHost, 1);
    //     property.props.splice(nodeIndexInTheHost, 1);
    //   }
    // }

    _this.inDOM = false;
    _this.properties = {};
  };

  var empty = function (nodes) {
    if (nodes instanceof Array) {
      nodes.forEach(function (node) {
        empty(node);
      });
    } else if (nodes) {
      nodes.node = null;
      empty(nodes.children);
    }
  };

  ViewNode.prototype.empty = function () {
    var toBeRemoved = [], node;
    for (var i = 0, len = this.node.childNodes.length; i < len; i++) {
      node = this.node.childNodes[i];
      toBeRemoved = toBeRemoved.concat(GV.getAllViewNodes(node));

      if (node.hasOwnProperty('__viewNode__')) {
        toBeRemoved.push(node.__viewNode__);
      }
    }

    toBeRemoved.forEach(function (viewNode) {
      viewNode.destroy();
    });
  };

  ViewNode.prototype.getPlaceholder = function () {
    if (this.inDOM) {
      return this.node;
    }

    return this.placeholder;
  };

})(Galaxy.GalaxyView);
