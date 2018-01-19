/* global Galaxy */

Galaxy.GalaxyView.BoundProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  /**
   *
   * @param {Array} parent
   * @param {Galaxy.GalaxyView.BoundProperty} bp
   */
  BoundProperty.installParentFor = function (parent, bp) {
    let i = 0, len = parent.length, item, itemParent;
    for (; i < len; i++) {
      item = parent[i];
      itemParent = item['__parents__'];

      if (itemParent === undefined) {
        GV.defineProp(item, '__parents__', {
          configurable: false,
          enumerable: false,
          value: [bp]
        });
      } else if (itemParent.indexOf(bp) === -1) {
        itemParent.push(bp);
      }
    }
  };

  /**
   *
   * @param {Array} list
   * @param {Galaxy.GalaxyView.BoundProperty} bp
   */
  BoundProperty.uninstallParentFor = function (list, bp) {
    list.forEach(function (item) {
      if (item['__parents__'] !== undefined) {
        let i = item['__parents__'].indexOf(bp);
        if (i !== -1) {
          item['__parents__'].splice(i, 1);
        }
      }
    });
  };

  /**
   *
   * @param {Object} host
   * @param {string} name
   * @param {*} value
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
     * @type {Array<Galaxy.GalaxyView.ViewNode|Object>}
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
  };

  BoundProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    const _this = this;
    let oldValue = _this.value;
    _this.value = value;
    if (value instanceof Array) {
      BoundProperty.installParentFor(value, _this);
      let init = GV.createActiveArray(value, this.updateValue.bind(this));

      if (target instanceof GV.ViewNode) {
        _this.setUpdateFor(target, key, init);
      }
    } else {
      _this.setValueFor(target, key, value, oldValue, scopeData);
    }
  };

  BoundProperty.prototype.setValue = function (value, scopeData) {
    if (value === this.value) {
      return;
    }

    let oldValue = this.value;
    this.value = value;
    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.updateValue.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.updateValue(change, {original: oldValue});
      Galaxy.GalaxyObserver.notify(this.host, this.name, change, oldValue);
    } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
      }
      Galaxy.GalaxyObserver.notify(this.host, this.name, value, oldValue);

      if (this.host['__parents__'] !== undefined) {
        this.host['__parents__'].forEach(function (con) {
          con.updateValue();
        });
      }
    }

  };

  BoundProperty.prototype.updateValue = function (changes, oldChanges) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        BoundProperty.installParentFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        BoundProperty.uninstallParentFor([changes.result], this);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        BoundProperty.uninstallParentFor(changes.result, this);
      }
    }

    for (let i = 0, len = this.nodes.length; i < len; i++) {
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
      if (!host.setters[attributeName]) {
        return console.info(host, attributeName, value);
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
   * @param {*} changes
   * @param {*} oldChanges
   */
  BoundProperty.prototype.setUpdateFor = function (host, attributeName, changes, oldChanges) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges);
    }
  };

  return BoundProperty;

})();
