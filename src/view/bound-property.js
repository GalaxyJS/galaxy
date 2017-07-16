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
  function BoundProperty(name, value) {
    /**
     * @public
     * @type {String} Name of the property
     */
    this.name = name;
    this.value = value;
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
      if (node instanceof Galaxy.GalaxyView.ViewNode) {
        node.addProperty(this, attributeName);
      }
      this.props.push(attributeName);
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.initValueFor = function (target, key, value, data) {
    this.value = value;
    if (value instanceof Array) {
      var init = GV.createActiveArray(value, this.updateValue.bind(this));
      if (target instanceof GV.ViewNode) {
        target.values[key] = value;
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, value, data);
    }
  };

  BoundProperty.prototype.setValue = function (value) {
    if (value !== this.value) {
      this.value = value;
      if (value instanceof Array) {
        GV.createActiveArray(value, this.updateValue.bind(this));
        this.updateValue({type: 'reset', params: value, original: value}, value);
      } else {
        for (var i = 0, len = this.nodes.length; i < len; i++) {
          this.setValueFor(this.nodes[i], this.props[i], value);
        }
      }
    }
  };

  BoundProperty.prototype.updateValue = function (changes, original) {
    for (var i = 0, len = this.nodes.length; i < len; i++) {
      this.nodes[i].value = original;
      this.setUpdateFor(this.nodes[i], this.props[i], changes);
    }
  };

  BoundProperty.prototype.setValueFor = function (node, attributeName, value, scopeData) {
    var newValue = value;

    if (node instanceof Galaxy.GalaxyView.ViewNode) {
      var mutator = node.mutator[attributeName];

      if (mutator) {
        newValue = mutator.call(node, value, node.values[attributeName]);
      }

      node.values[attributeName] = newValue;
      if (!node.setters[attributeName]) {
        console.info(node, attributeName, newValue);
      }

      node.setters[attributeName](newValue, scopeData);
    } else {
      node[attributeName] = newValue;
    }
  };

  BoundProperty.prototype.setUpdateFor = function (node, attributeName, changes) {
    node.setters[attributeName](changes);
  };

})(Galaxy.GalaxyView);
