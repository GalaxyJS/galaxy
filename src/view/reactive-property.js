/* global Galaxy */

Galaxy.GalaxyView.ReactiveProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  /**
   *
   * @param {Array|Object} host
   * @param {Galaxy.GalaxyView.ReactiveProperty} rp
   */
  ReactiveProperty.installOwnerFor = function (host, rp) {
    if (host instanceof Array) {
      let i = 0, len = host.length, itemPortal, ppp;
      for (; i < len; i++) {
        itemPortal = GV.getPortal(host[i]);
        ppp = host[i]['__parents__'];

        if (itemPortal !== undefined) {
          itemPortal.addOwner(rp);
        }
        if (ppp === undefined) {
          GV.defineProp(host[i], '__parents__', {
            configurable: false,
            enumerable: false,
            value: [rp]
          });
        } else if (ppp.indexOf(rp) === -1) {
          ppp.push(rp);
        }
      }
    } else {
      const itemPortal = GV.getPortal(host);

      if (itemPortal !== undefined) {
        itemPortal.addOwner(rp);
      }
      // if (itemParent === undefined) {
      //   GV.defineProp(host, '__parents__', {
      //     configurable: false,
      //     enumerable: false,
      //     value: [bp]
      //   });
      // } else if (itemParent.indexOf(bp) === -1) {
      //   itemParent.push(bp);
      // }
    }
  };

  /**
   *
   * @param {Array} list
   * @param {Galaxy.GalaxyView.ReactiveProperty} rp
   */
  ReactiveProperty.uninstallOwnerFor = function (list, rp) {
    let itemPortal;
    list.forEach(function (item) {
      itemPortal = item[GV.PORTAL_PROPERTY_IDENTIFIER];
      if (itemPortal !== undefined) {
        itemPortal.removeOwner(rp);
        // let i = item['__parents__'].indexOf(bp);
        // if (i !== -1) {
        //   item['__parents__'].splice(i, 1);
        // }
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
  function ReactiveProperty(host, name, value) {
    this.host = host;
    this.name = name;
    this.value = value;
    this.descriptors = null;
    this.keys = [];
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
  ReactiveProperty.prototype.addNode = function (node, attributeName, expression) {
    let index = this.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || this.keys[index] !== attributeName) {
      if (node instanceof Galaxy.GalaxyView.ViewNode && !node.setters[attributeName]) {
        node.installPropertySetter(this, attributeName, expression);
      }

      this.keys.push(attributeName);
      this.nodes.push(node);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   */
  ReactiveProperty.prototype.removeNode = function (node) {
    let nodeIndexInTheHost;
    while ((nodeIndexInTheHost = this.nodes.indexOf(node)) !== -1) {
      this.nodes.splice(nodeIndexInTheHost, 1);
      this.keys.splice(nodeIndexInTheHost, 1);
    }
  };

  /**
   * Save the value descriptors if it has portal(in other word, it's an object)
   */
  ReactiveProperty.prototype.save = function () {
    if (this.value && this.value.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
      this.descriptors = Object.getOwnPropertyDescriptors(this.value);
    }
  };

  ReactiveProperty.prototype.revive = function () {
    this.value = {};
    Object.defineProperties(this.value, this.descriptors);
  };

  ReactiveProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    const oldValue = this.value;
    this.value = value;
    this.save();

    if (value instanceof Array) {
      ReactiveProperty.installOwnerFor(value, this);
      let init = GV.createActiveArray(value, this.updateValue.bind(this));

      if (target instanceof GV.ViewNode) {
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, value, oldValue, scopeData);
    }
  };

  ReactiveProperty.prototype.setValue = function (value, scopeData) {
    if (value === this.value) {
      return;
    }

    const oldValue = this.value;
    this.value = value;
    this.save();

    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.updateValue.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.updateValue(change, { original: oldValue });
      Galaxy.GalaxyObserver.notify(this.host, this.name, change, oldValue, this);
    } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue, scopeData);
      }
      Galaxy.GalaxyObserver.notify(this.host, this.name, value, oldValue, this);
    }
  };

  ReactiveProperty.prototype.updateValue = function (changes, oldChanges) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        ReactiveProperty.installOwnerFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        ReactiveProperty.uninstallOwnerFor([changes.result], this);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        ReactiveProperty.uninstallOwnerFor(changes.result, this);
      }
    }

    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.keys[i], changes, oldChanges);
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
  ReactiveProperty.prototype.setValueFor = function (host, attributeName, value, oldValue, scopeData) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      if (!host.setters[attributeName]) {
        return console.info(host, attributeName, value);
      }

      host.setters[attributeName](value, oldValue, scopeData);
    } else {
      host[attributeName] = value;
      // if(attributeName === 'active') debugger;
      Galaxy.GalaxyObserver.notify(host, attributeName, value, oldValue, this);
    }
  };

  /**
   *
   * @param {(Galaxy.GalaxyView.ViewNode|Object)} host
   * @param {string} attributeName
   * @param {*} changes
   * @param {*} oldChanges
   */
  ReactiveProperty.prototype.setUpdateFor = function (host, attributeName, changes, oldChanges) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges, this);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   */
  ReactiveProperty.prototype.concat = function (property) {
    this.nodes = this.nodes.concat(property.nodes);
    this.keys = this.keys.concat(property.keys);
  };

  return ReactiveProperty;

})();
