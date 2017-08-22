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
  function BoundProperty(host, name, value) {
    /**
     * @public
     * @type {String} Name of the property
     */
    this.host = host;
    this.name = name;
    this.value = value;
    this.props = [];
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {String} attributeName
   * @param {Function} expression
   * @public
   */
  BoundProperty.prototype.addNode = function (node, attributeName, expression) {
    if (this.nodes.indexOf(node) === -1) {
      if (node instanceof Galaxy.GalaxyView.ViewNode) {
        node.installPropertySetter(this, attributeName, expression);
      }

      this.props.push(attributeName);
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.removeNode = function (node) {
    var nodeIndexInTheHost = this.nodes.indexOf(node);
    if (nodeIndexInTheHost !== -1) {
      this.nodes.splice(nodeIndexInTheHost, 1);
      this.props.splice(nodeIndexInTheHost, 1);
    }
  };

  BoundProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    var oldValue = this.value;
    this.value = value;
    if (value instanceof Array) {
      var init = GV.createActiveArray(value, this.updateValue.bind(this));
      if (target instanceof GV.ViewNode) {
        target.values[key] = value;
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, value, oldValue, scopeData);
    }
  };

  BoundProperty.prototype.setValue = function (value, scopeData) {
    if (value !== this.value) {
      var oldValue = this.value;
      this.value = value;
      if (value instanceof Array) {
        var oldChanges = GV.createActiveArray(value, this.updateValue.bind(this));
        var change = {type: 'reset', params: value, original: value};
        this.updateValue(change, oldChanges);
        Galaxy.GalaxyObserver.notify(this.host, this.name, change, oldValue);
      } else {
        for (var i = 0, len = this.nodes.length; i < len; i++) {
          this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
        }
        Galaxy.GalaxyObserver.notify(this.host, this.name, value, oldValue);
      }
    }
  };

  BoundProperty.prototype.updateValue = function (changes, oldChanges) {
    for (var i = 0, len = this.nodes.length; i < len; i++) {
      this.nodes[i].value = changes.original;
      this.setUpdateFor(this.nodes[i], this.props[i], changes, oldChanges);
    }
  };

  BoundProperty.prototype.setValueFor = function (host, attributeName, value, oldValue, scopeData) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.values[attributeName] = value;
      if (!host.setters[attributeName]) {
        console.info(host, attributeName, value);
      }

      host.setters[attributeName](value, oldValue, scopeData);
    } else {
      host[attributeName] = value;
      Galaxy.GalaxyObserver.notify(host, attributeName, value, oldValue);
    }
  };

  BoundProperty.prototype.setUpdateFor = function (host, attributeName, changes, oldChanges) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      // host.__observer__.notify(attributeName, changes, oldChanges);
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges);
    }
  };

})(Galaxy.GalaxyView);
