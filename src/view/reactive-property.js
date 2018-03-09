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
  ReactiveProperty.prototype.addNode = function (node, attributeName, scope, expression) {
    let index = this.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || this.keys[index] !== attributeName) {
      if (node instanceof Galaxy.GalaxyView.ViewNode && !node.setters[attributeName]) {
        // debugger;
        node.installPropertySetter(this, attributeName, scope, expression);
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
      let init = GV.createActiveArray(this.value, this.update.bind(this));

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

    this.oldValue = this.value;
    if (value instanceof Array) {
      debugger;
    }
    this.applyValue(value, scopeData);
  };

  ReactiveProperty.prototype.applyValue = function (value, scopeData) {
    let oldValue = this.oldValue;
    if (value !== this.value) {
      oldValue = this.oldValue = this.value;
    }

    this.value = value;
    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.update.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.update(change, { original: oldValue });
      Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue, this.portal);
    } else {
      let i = 0, len = this.nodes.length;
      for (; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue, scopeData);
      }
      Galaxy.GalaxyObserver.notify(this.portal, this.name, value, oldValue, this.portal);
    }
  };

  ReactiveProperty.prototype.update = function (changes, oldChanges) {
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

  ReactiveProperty.prototype.notify = function (caller) {
    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.keys[i], this.value, this.oldValue);
    }

    if (!this.placeholderFor) {
      Galaxy.GalaxyObserver.notify(this.portal, this.name, this.value, this.oldValue, caller);
    } else {
      debugger;
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
      // host[attributeName] = changes;
    }
  };

  ReactiveProperty.prototype.softUpdate = function (value) {
    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.update.bind(this));
      change.type = 'reset';
      change.result = this.oldValue;
      debugger
      this.update(change, { original: this.oldValue });
    } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setUpdateFor(this.nodes[i], this.keys[i], value, this.oldValue);
      }
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

  ReactiveProperty.prototype.setPlaceholder = function (value) {
    const valuePortal = value[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    valuePortal.addParent(this);
    const oldKeys = Object.keys(this.valueStructure);
    const valueStructurePortal = this.valueStructure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    debugger;
    oldKeys.forEach(function (key) {
      // We use soft just to update UI and leave the actual data of
      // the valueStructurePortal intact
      if (valuePortal.refs[key]) {
        valuePortal.refs[key].concat(valueStructurePortal.refs[key]);
      }
      valueStructurePortal.refs[key].softUpdate(value[key]);
    });
  };

  ReactiveProperty.prototype.removePlaceholder = function () {
    if (!this.placeholderFor) {
      return;
    }

    const _this = this;
    const placeholderPortal = this.placeholderFor[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    placeholderPortal.removeParent(_this);
    const keys = Object.keys(this.placeholderFor);
    // const valueStructurePortal = this.valueStructure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];

    keys.forEach(function (key) {
      if (placeholderPortal.refs[key]) {
        placeholderPortal.refs[key].removeNodesByProperty(_this);
      }
      // valueStructurePortal.refs[key].softUpdate(this.placeholderFor[key]);
    });
    this.placeholderFor = null;
  };

  return ReactiveProperty;

})();
