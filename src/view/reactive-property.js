/* global Galaxy */

Galaxy.GalaxyView.ReactiveProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  /**
   *
   * @param {Array|Object} host
   * @param {Galaxy.GalaxyView.ReactiveProperty} reactiveProperty
   */
  ReactiveProperty.installParentFor = function (host, reactiveProperty) {
    if (host instanceof Array) {
      let i = 0, len = host.length, itemPortal;
      for (; i < len; i++) {
        itemPortal = GV.getPortal(host[i]);
        if (itemPortal !== undefined) {
          itemPortal.addParent(reactiveProperty);
        }
      }
    } else {
      const itemPortal = GV.getPortal(host);
      if (itemPortal !== undefined) {
        itemPortal.addParent(reactiveProperty);
      }
    }
  };

  /**
   *
   * @param {Array} list
   * @param {Galaxy.GalaxyView.ReactiveProperty} reactiveProperty
   */
  ReactiveProperty.uninstallParentFor = function (list, reactiveProperty) {
    let itemPortal;
    list.forEach(function (item) {
      itemPortal = item[GV.PORTAL_PROPERTY_IDENTIFIER];
      if (itemPortal !== undefined) {
        itemPortal.removeParent(reactiveProperty);
      }
    });
  };

  /**
   *
   * @param {Object|Galaxy.GalaxyView.Portal} portal
   * @param {string} name
   * @param {*} value
   * @param {any?} valueStructure
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ReactiveProperty(portal, name, value, valueStructure) {
    this.name = name;

    this.oldValue = undefined;
    this.value = value;
    this.portal = portal;
    this.valueStructure = null;

    this.keys = [];
    this.nodes = [];

    this.placeholderFor = null;
    this.valueStructure = valueStructure || null;
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @param {Function} expression
   * @public
   */
  ReactiveProperty.prototype.addNode = function (node, attributeName, expression,scope) {
    let index = this.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || this.keys[index] !== attributeName) {
      if (node instanceof Galaxy.GalaxyView.ViewNode && !node.setters[attributeName]) {
        node.installPropertySetter(this, attributeName, expression,scope);
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
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   */
  ReactiveProperty.prototype.removeNodesByProperty = function (property) {
    const _this = this;
    property.nodes.forEach(function (node) {
      _this.removeNode(node);
    });
  };

  ReactiveProperty.prototype.setValueStructure = function (structure) {
    this.valueStructure = (structure !== null && typeof structure === 'object') ? structure : null;
  };

  ReactiveProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    // const oldValue = this.value;
    this.value = value;

    if (this.value instanceof Array) {
      ReactiveProperty.installParentFor(this.value, this);
      let init = GV.createActiveArray(this.value, this.updateValue.bind(this));

      if (target instanceof GV.ViewNode) {
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, this.value, this.oldValue, scopeData);
    }
  };

  ReactiveProperty.prototype.setValue = function (value, scopeData) {
    if (value === this.value) {
      return;
    }

    const oldValue = this.oldValue = this.value;
    this.value = value;
    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.updateValue.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.updateValue(change, { original: oldValue });
      Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue, this.portal);
    } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue, scopeData);
      }
      Galaxy.GalaxyObserver.notify(this.portal, this.name, value, oldValue, this.portal);
    }
  };

  ReactiveProperty.prototype.applyValue = function (value, scopeData) {
    let oldValue = this.oldValue;
    if (value !== this.value) {
      oldValue = this.oldValue = this.value;
    }

    this.value = value;
    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.updateValue.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.updateValue(change, { original: oldValue });
      Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue, this.portal);
    } else {
      let i = 0, len = this.nodes.length;
      for (; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue, scopeData);
      }

      if (len === 0) {
        Galaxy.GalaxyObserver.notify(this.portal, this.name, value, oldValue, this.portal);
      }
    }
  };

  ReactiveProperty.prototype.updateValue = function (changes, oldChanges) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        ReactiveProperty.installParentFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        ReactiveProperty.uninstallParentFor([changes.result], this);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        ReactiveProperty.uninstallParentFor(changes.result, this);
      }
    }

    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.keys[i], changes, oldChanges);
    }
  };

  ReactiveProperty.prototype.refresh = function () {
    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.keys[i], this.value, this.oldValue);
    }
    // this.applyValue(this.value);
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
      // debugger;
      host[attributeName] = value;
      Galaxy.GalaxyObserver.notify(host, attributeName, value, oldValue, this.portal);
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
      host.setters[attributeName](changes, oldChanges);
    } else {
      // host[attributeName]=changes;
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges, this.portal);
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

  ReactiveProperty.prototype.clone = function (portal) {
    const clone = new Galaxy.GalaxyView.ReactiveProperty(portal, this.name, null);
    clone.concat(this);
    clone.valueStructure = this.valueStructure;

    return clone;
  };

  ReactiveProperty.prototype.removePlaceholder = function () {
    this.placeholderFor = null;
  };

  return ReactiveProperty;

})();
