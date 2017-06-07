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

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param node
   * @param schema
   * @constructor
   */
  function ViewNode(root, schema) {
    /**
     *
     * @public
     * @type {Galaxy.GalaxyView}
     */
    this.root = root;
    this.node = schema.node || createElem(schema.tag || 'div');
    this.schema = schema;
    this.data = {};
    this.mutator = {};
    this.template = false;
    this.placeholder = createComment(schema.tag || 'div');
    this.properties = {};
    this.values = {};
    this.inDOM = typeof schema.inDOM === 'undefined' ? true : schema.inDOM;
    this.setters = {};
    this.parent = null;
  }

  ViewNode.prototype.cloneSchema = function () {
    var clone = Object.assign({}, this.schema);
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
      removeChild(_this.node.parentNode, _this.placeholder);
      removeChild(_this.node.parentNode, _this.node);
    } else {
      removeChild(_this.placeholder.parentNode, _this.placeholder);
    }

    var nodeIndexInTheHost, property;

    for (var propertyName in _this.properties) {
      property = _this.properties[propertyName];
      nodeIndexInTheHost = property.nodes.indexOf(_this);
      if (nodeIndexInTheHost !== -1) {
        property.nodes.splice(nodeIndexInTheHost, 1);
      }
    }

    _this.properties = {};
  };

  ViewNode.prototype.empty = function () {
    this.node.innerHTML = '';
  };

})(Galaxy.GalaxyView);
