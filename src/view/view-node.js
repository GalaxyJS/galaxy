/* global Galaxy */
(function (GV) {
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
    this.node = document.createElement(nodeSchema.t || 'div');
    this.nodeSchema = nodeSchema;
    this.data = {};
    this.mutator = {};
    this.template = false;
    this.placeholder = document.createComment(this.node.tagName);
    this.properties = {};
    this.values = {};
    this.inDOM = typeof nodeSchema.inDOM === 'undefined' ? true : nodeSchema.inDOM;
    this.setters = {};
    this.reactive = {};
  }

  ViewNode.prototype.cloneSchema = function () {
    return Galaxy.extend({
      mother: this
    }, this.nodeSchema);
  };

  ViewNode.prototype.toTemplate = function () {
    this.placeholder.nodeValue = JSON.stringify(this.nodeSchema, null, 2);
    this.template = true;
  };

  ViewNode.prototype.setInDOM = function (flag) {
    this.inDOM = flag;
    if (flag && !this.node.parentNode && !this.template) {
      this.placeholder.parentNode.insertBefore(this.node, this.placeholder.nextSibling);
      this.placeholder.parentNode.removeChild(this.placeholder);
    } else if (!flag && this.node.parentNode) {
      this.node.parentNode.insertBefore(this.placeholder, this.node);
      this.node.parentNode.removeChild(this.node);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.BoundProperty} property
   */
  ViewNode.prototype.addProperty = function (property, attributeName) {
    this.properties[property.name] = property;
    this.setters[attributeName] = this.root.getPropertySetter(this, attributeName);
  };

  ViewNode.prototype.destroy = function () {
    var _this = this;

    if (_this.inDOM) {
      _this.node.parentNode.removeChild(_this.placeholder);
      _this.node.parentNode.removeChild(_this.node);
    } else {
      _this.placeholder.parentNode.removeChild(_this.placeholder);
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

})(Galaxy.GalaxyView);
