(function (GV) {

  GV.BoundProperty = BoundProperty;

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} viewNode
   * @constructor
   */
  function BoundProperty() {
    this.hosts = [];
    this.value = null;
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   */
  BoundProperty.prototype.addNode = function (node) {
    if (this.nodes.indexOf(node) === -1) {
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.setValue = function (attributeName, value) {
    var _this = this;
    _this.nodes.forEach(function (node) {
      if (node.mutator[ attributeName ]) {
        node.root.setPropertyForNode(node, attributeName, node.mutator[ attributeName ].call(node, value));
      } else {
        node.root.setPropertyForNode(node, attributeName, value);
      }
    });
  };
})(Galaxy.GalaxyView);