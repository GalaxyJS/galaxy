/* global Galaxy */

Galaxy.GalaxyView.ReactiveProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
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
  function ReactiveProperty(portal, name, value) {
    this.name = name;

    this.oldValue = undefined;
    this.value = value;
    /** @type {Galaxy.GalaxyView.Portal} */
    this.portal = portal;

    this.keys = [];
    this.nodes = [];

    this.placeholderFor = null;
    // Holds the structure of bindings
    this.structure = {};
    if (value && value[GV.PORTAL_PROPERTY_IDENTIFIER]) {
      GV.setPortalFor(this.structure, value[GV.PORTAL_PROPERTY_IDENTIFIER]);
    } else {
      GV.initPortalFor(this.structure);
    }
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

  ReactiveProperty.prototype.setEmpty = function (flag) {
    this.empty = flag;
  };

  ReactiveProperty.prototype.unbindValue = function () {
    const _this = this;
    if (!_this.value || typeof _this.value !== 'object') {
      return;
    }

    const oldKeys = objKeys(_this.value);
    oldKeys.forEach(function (key) {
      const temp = _this.value[key];
      GV.defineProp(_this.value, key, {
        enumerable: true,
        configurable: true,
        value: temp
      });
    });

    Reflect.deleteProperty(_this.value, GV.PORTAL_PROPERTY_IDENTIFIER);
  };

  ReactiveProperty.prototype.setValue = function (value, scopeData) {
    if (value === this.value) {
      return;
    }

    this.oldValue = value;
    this.value = value;
    this.syncNodes(value, scopeData);
    this.syncStructure(value, scopeData);
  };

  ReactiveProperty.prototype.syncStructure = function (value, scopeData) {
    const _this = this;
    const keys = objKeys(_this.structure);
    if (value === null || value === undefined) {
      keys.forEach(function (key) {
        _this.structure[key] = undefined;
      });
    }
    else {
      keys.forEach(function (key) {
        _this.structure[key] = value[key];
      });
    }
  };

  ReactiveProperty.prototype.syncNodes = function (value, scopeData) {
    let oldValue = this.oldValue;
    // if (value !== this.value) {
    //   oldValue = this.oldValue = this.value;
    // }
    //

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
    // TODO: this will fail for when value is an array. Because array value are parsed to `DataChange` format
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
      debugger;
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
    clone.structure = this.structure;

    return clone;
  };

  ReactiveProperty.prototype.setPlaceholder = function (value) {
    const _this = this;
    // this.placeholderFor = value;
    const valuePortal = value[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    const valueStructure = valuePortal.self.structure;
    const valueRefs = valuePortal.refs;
    const oldKeys = Object.keys(_this.structure);
    const currentStructurePortalRefs = _this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER].refs;

    _this.unbindValue();

    valuePortal.self.concat(_this);
    _this.portal.refs[_this.name] = valuePortal.self;

    oldKeys.forEach(function (key) {
      if (valueRefs[key]) {
        valueRefs[key].concat(currentStructurePortalRefs[key]);
      } else if (currentStructurePortalRefs[key]) {
        const cloned = currentStructurePortalRefs[key].clone(valuePortal);
        cloned.value = value[key];
        valuePortal.setProperty(cloned, key);
        if (!valueStructure[key]) {
          GV.defineProp(valueStructure, key, Object.getOwnPropertyDescriptor(_this.structure, key));
        }

        GV.defineProp(value, key, Object.getOwnPropertyDescriptor(_this.structure, key));
      }

      valuePortal.refs[key].syncNodes(value[key]);
    });

    this.notify(this);
  };

  ReactiveProperty.prototype.removePlaceholder = function () {
    if (!this.placeholderFor) {
      return;
    }

    const _this = this;
    const placeholderPortal = this.placeholderFor[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    placeholderPortal.removeParent(_this);
    const keys = Object.keys(this.placeholderFor);
    // const valueStructurePortal = this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];

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
