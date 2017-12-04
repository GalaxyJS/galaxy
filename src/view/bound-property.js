/* global Galaxy */

(function (GV) {
  /**
   *
   * @type {Galaxy.GalaxyView.BoundProperty}
   */
  GV.BoundProperty = BoundProperty;

  /**
   *
   * @param {Galaxy.GalaxyView.BoundProperty} bp
   * @param {Array} list
   */
  BoundProperty.installContainerList = function (bp, list) {
    list.forEach(function (item) {
      if (item.hasOwnProperty('__lists__')) {
        if (item['__lists__'].indexOf(bp) === -1) {
          item['__lists__'].push(bp);
        }
      } else {
        GV.defineProp(item, '__lists__', {
          configurable: false,
          enumerable: false,
          value: [bp]
        });
      }
    });
  };

  BoundProperty.uninstallContainerList = function (bp, list) {
    list.forEach(function (item) {
      if (item.hasOwnProperty('__lists__')) {
        let i = item['__lists__'].indexOf(bp);
        if (i !== -1) {
          item['__lists__'].splice(i, 1);
        }
      }
    });
  };

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
    this.lists = [];
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
      BoundProperty.installContainerList(_this, value);
      let init = GV.createActiveArray(value, this.updateValue.bind(this));

      if (target instanceof GV.ViewNode) {
        target.data[key] = value;
        _this.setUpdateFor(target, key, init);
      }
    } else {
      _this.setValueFor(target, key, value, oldValue, scopeData);
    }
  };

  BoundProperty.prototype.setValue = function (value, scopeData) {
    if (value !== this.value) {
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

        this.lists.forEach(function (con) {
          con.updateValue();
        });
      }
    }
  };

  BoundProperty.prototype.updateValue = function (changes, oldChanges) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        BoundProperty.installContainerList(this, changes.params);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        BoundProperty.uninstallContainerList(this, [changes.result]);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        BoundProperty.uninstallContainerList(this, changes.result);
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
      host.data[attributeName] = value;
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
      // console.info('node', attributeName, changes);
    } else {
      // host.__observer__.notify(attributeName, changes, oldChanges);
      // console.info('notify', attributeName, changes);
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges);
    }


  };

})(Galaxy.GalaxyView);
