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
      } else {
        var handler = {
          value: function () {
          },
          writable: true,
          configurable: true
        };

        GV.defineProp(node, '__onChange__', handler);
        GV.defineProp(node, '__onUpdate__', handler);
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
        GV.createActiveArray(value, this.updateValue.bind(this));
        this.updateValue({type: 'reset', params: value, original: value}, value);
      } else {
        for (var i = 0, len = this.nodes.length; i < len; i++) {
          this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
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

  BoundProperty.prototype.setValueFor = function (host, attributeName, value, oldValue, scopeData) {
    var newValue = value;

    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      var mutator = host.mutator[attributeName];

      if (mutator) {
        newValue = mutator.call(host, value, host.values[attributeName]);
      }

      host.values[attributeName] = newValue;
      if (!host.setters[attributeName]) {
        console.info(host, attributeName, newValue);
      }

      host.setters[attributeName](newValue, oldValue, scopeData);
    } else {
      host[attributeName] = newValue;
      host.__onChange__(attributeName, newValue, oldValue, host);
    }
  };

  BoundProperty.prototype.setUpdateFor = function (host, attributeName, changes) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      host.__onUpdate__(attributeName, changes, host);
    }
  };

})(Galaxy.GalaxyView);
