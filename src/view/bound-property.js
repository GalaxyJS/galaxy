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
    this.props = [];
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {String} attributeName
   * @public
   */
  BoundProperty.prototype.addNode = function (node, attributeName) {
    if (this.nodes.indexOf(node) === -1) {
      node.addProperty(this, attributeName);
      this.props.push(attributeName);
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.setValue = function (value) {
    this.value = value;
    for (var i = 0, len = this.nodes.length; i < len; i++) {
      this.setValueFor(this.nodes[i], this.props[i], value);
    }
  };

  BoundProperty.prototype.updateValue = function (value) {
    for (var i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.props[i], value);
    }
  };

  BoundProperty.prototype.setValueFor = function (node, attributeName, value) {
    var mutator = node.mutator[attributeName];
    var newValue = value;

    if (mutator) {
      newValue = mutator.call(node, value, node.values[attributeName]);
    }

    node.values[attributeName] = newValue;
    if (!node.setters[attributeName]) {
      console.info(node, attributeName, newValue);
      debugger
    }

    node.setters[attributeName](newValue);
  };

  BoundProperty.prototype.setUpdateFor = function (node, attributeName, value) {
    node.setters[attributeName](value);
  };

})(Galaxy.GalaxyView);
