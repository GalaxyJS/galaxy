(function (GV) {
  GV.ViewNode = ViewNode;

  /**
   *
   * @param {Galaxy.GalaxyView} root
   * @param node
   * @param nodeSchema
   * @constructor
   */
  function ViewNode(root, nodeSchema) {
    this.root = root;
    this.node = document.createElement(nodeSchema.t || 'div');
    this.nodeSchema = nodeSchema;
    this.scope = {};
    this.mutator = {};
    this.template = false;
    this.placeholder = document.createComment(this.node.tagName);
    this.parents = [];
    this.inDOM = true;

    this.node.__galaxyView__ = this;
  }

  ViewNode.prototype.toTemplate = function () {
    this.placeholder.nodeValue = JSON.stringify(this.nodeSchema, null, 2);
    this.template = true;
  };

  ViewNode.prototype.setInDOM = function (flag) {
    this.inDOM = flag;
    if (flag && !this.node.parentNode && !this.template) {
      this.placeholder.parentNode.insertBefore(this.node, this.placeholder.nextSibling);
    } else if (!flag && this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  };

  ViewNode.prototype.addHostNode = function (item) {
    if (this.parents.indexOf(item) === -1) {
      this.parents.push(item);
    }
  };

  ViewNode.prototype.destroy = function () {
    var _this = this;

    if (_this.inDOM) {
      _this.node.parentNode.removeChild(_this.placeholder);
      _this.node.parentNode.removeChild(_this.node);
    } else {
      _this.placeholder.parentNode.removeChild(_this.placeholder);
    }

    var nodeIndexInTheHost = -1;
    _this.parents.forEach(function (host) {
      nodeIndexInTheHost = host.indexOf(_this);
      if (nodeIndexInTheHost !== -1) {
        host.splice(nodeIndexInTheHost, 1);
      }
    });

    _this.parents = [];
  }

})(Galaxy.GalaxyView);