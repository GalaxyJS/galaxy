/* global Galaxy */

(function (GV) {
  /**
   *
   * @type {Galaxy.GalaxyView.BoundProperty}
   */
  GV.BoundProperty = BoundProperty;

  /**
   *
   * @param {Object} host
   * @param {string} name
   * @param {} value
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function BoundProperty(host, name, value) {
    this.host = host;
    this.name = name;
    this.value = value;
    this.props = [];
    /**
     *
     * @type {Array<Galaxy.GalaxyView.ViewNode>}
     */
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @param {Function} expression
   * @public
   */
  BoundProperty.prototype.addNode = function (node, attributeName, expression) {
    let index = this.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || this.props[index] !== attributeName) {
      if (node instanceof Galaxy.GalaxyView.ViewNode) {
        node.installPropertySetter(this, attributeName, expression);
      }

      this.props.push(attributeName);
      this.nodes.push(node);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   */
  BoundProperty.prototype.removeNode = function (node) {
    let nodeIndexInTheHost;
    while ((nodeIndexInTheHost = this.nodes.indexOf(node)) !== -1) {
      this.nodes.splice(nodeIndexInTheHost, 1);
      this.props.splice(nodeIndexInTheHost, 1);
    }
    // var nodeIndexInTheHost = this.nodes.indexOf(node);
    // if (nodeIndexInTheHost !== -1) {
    //   this.nodes.splice(nodeIndexInTheHost, 1);
    //   this.props.splice(nodeIndexInTheHost, 1);
    // }
  };

  BoundProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    let oldValue = this.value;
    this.value = value;
    if (value instanceof Array) {
      let init = GV.createActiveArray(value, this.updateValue.bind(this));
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
      let oldValue = this.value;
      this.value = value;
      if (value instanceof Array) {
        let oldChanges = GV.createActiveArray(value, this.updateValue.bind(this));
        let change = {type: 'reset', params: value, original: value};
        this.updateValue(change, oldChanges);
        Galaxy.GalaxyObserver.notify(this.host, this.name, change, oldValue);
      } else {
        for (let i = 0, len = this.nodes.length; i < len; i++) {
          this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
        }
        Galaxy.GalaxyObserver.notify(this.host, this.name, value, oldValue);
      }
    }
  };

  BoundProperty.prototype.updateValue = function (changes, oldChanges) {
    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.nodes[i].value = changes.original;
      this.setUpdateFor(this.nodes[i], this.props[i], changes, oldChanges);
    }
  };

  /**
   *
   * @param {(Galaxy.GalaxyView.ViewNode|Object)} host
   * @param {string} attributeName
   * @param value
   * @param oldValue
   * @param scopeData
   */
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

  /**
   *
   * @param {(Galaxy.GalaxyView.ViewNode|Object)} host
   * @param {string} attributeName
   * @param {} changes
   * @param {} oldChanges
   */
  BoundProperty.prototype.setUpdateFor = function (host, attributeName, changes, oldChanges) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      // host.__observer__.notify(attributeName, changes, oldChanges);
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges);
    }
  };

})(Galaxy.GalaxyView);
