/* global Galaxy */

(function (GV) {

  /**
   *
   * @returns {Galaxy.GalaxyView.BoundProperty}
   */
  GV.BoundProperty = BoundProperty;

  /**
   *
   * @param {String} name
   * @constructor
   */
  function BoundProperty(name) {
    /**
     * @public
     * @type {String} Name of the property
     */
    this.name = name;
    this.value = null;
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @public
   */
  BoundProperty.prototype.addNode = function (node) {
    if (this.nodes.indexOf(node) === -1) {
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.setValue = function (attributeName, value, changes) {
    this.value = value;
    if (changes) {
      for (var i = 0, len = this.nodes.length; i < len; i++) {
        this.setMutatedValueFor(this.nodes[i], attributeName, changes);
      }
    } else {
      for (var i = 0, len = this.nodes.length; i < len; i++) {
        this.setValueFor(this.nodes[i], attributeName, value);
      }
    }
  };

  BoundProperty.prototype.setValueFor = function (node, attributeName, value) {
    var mutator = node.mutator[attributeName];
    var newValue = value;

    if (mutator) {
      newValue = mutator.call(node, value, node.values[attributeName]);
    }

    node.values[attributeName] = newValue;
    node.root.setPropertyForNode(node, attributeName, newValue);
  };

  BoundProperty.prototype.setMutatedValueFor = function (node, attributeName, changes) {
    node.root.setPropertyForNode(node, attributeName, changes);
  };

})(Galaxy.GalaxyView);
