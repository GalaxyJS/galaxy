/* global Galaxy */
(function (GV) {

  function createElem(t) {
    return document.createElement(t);
  }

  var commentNode = document.createComment('');

  function createComment(t) {
    return commentNode.cloneNode();
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
   * @param nodeSchema
   * @constructor
   */
  function ViewNode(root, nodeSchema) {
    /**
     *
     * @public
     * @type {Galaxy.GalaxyView}
     */
    this.root = root;
    this.node = createElem(nodeSchema.tag || 'div');
    this.nodeSchema = nodeSchema;
    this.data = {};
    this.mutator = {};
    this.template = false;
    this.placeholder = createComment(nodeSchema.tag || 'div');
    this.properties = {};
    this.values = {};
    this.inDOM = typeof nodeSchema.inDOM === 'undefined' ? true : nodeSchema.inDOM;
    this.setters = {};
    this.reactive = {};
  }

  ViewNode.prototype.cloneSchema = function () {
    var clone = Object.assign({}, this.nodeSchema);
    Object.defineProperty(clone, 'mother', {
      value: this.nodeSchema,
      writable: false,
      enumerable: false,
      configurable: false
    });

    return clone;
  };

  ViewNode.prototype.toTemplate = function () {
    this.placeholder.nodeValue = JSON.stringify(this.nodeSchema, null, 2);
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
