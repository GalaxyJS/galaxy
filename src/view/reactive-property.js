/* global Galaxy */

Galaxy.GalaxyView.ReactiveProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
  const defineProp = Object.defineProperty;
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
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ReactiveProperty(portal, name, value) {
    const _this = this;
    _this.name = name;

    _this.oldValue = undefined;
    _this.value = value;

    /** @type {Galaxy.GalaxyView.Portal} */
    _this.portal = portal;

    _this.keys = [];
    _this.nodes = [];

    _this.placeholderFor = null;
    // Holds the structure of bindings
    _this.structure = {};

    if (value && value[GV.PORTAL_PROPERTY_IDENTIFIER]) {
      GV.setPortalFor(_this.structure, value[GV.PORTAL_PROPERTY_IDENTIFIER]);
    } else {
      GV.initPortalFor(_this.structure);
    }

    defineProp(_this, 'valueScope', {
      configurable: false,
      enumerable: true,
      get: function () {
        if (_this.placeholderFor) {
          return _this.placeholderFor;
        }

        return _this.value;
      }
    });
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @param {Function} expression
   * @param {Galaxy.GalaxyView.ReactiveProperty} scopeProperty
   * @public
   */
  ReactiveProperty.prototype.addNode = function (node, attributeName, expression, scopeProperty) {
    let index = this.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || this.keys[index] !== attributeName) {
      if (node instanceof Galaxy.GalaxyView.ViewNode && !node.setters[attributeName]) {
        node.installPropertySetter(this, attributeName, expression, scopeProperty);
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
    const keys = property.keys;
    property.nodes.forEach(function (node, i) {
      _this.nodes.forEach(function (n, ii) {
        if (node === n && _this.keys[ii] === keys[i]) {
          _this.nodes.splice(ii, 1);
          _this.keys.splice(ii, 1);
        }
      });
    });
  };

  ReactiveProperty.prototype.initValueFor = function (target, key, value) {
    this.value = value;

    if (this.value instanceof Array) {
      // TODO: the logic for handling array values could be simpler!?
      ReactiveProperty.installParentFor(this.value, this);
      const init = GV.createActiveArray(this.value, this.update.bind(this));
      if (target instanceof GV.ViewNode) {
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, this.value, this.oldValue);
    }
  };

  ReactiveProperty.prototype.unbindValue = function () {
    const _this = this;
    if (!_this.value || typeof _this.value !== 'object') {
      return;
    }

    const oldKeys = objKeys(_this.value);
    oldKeys.forEach(function (key) {
      const temp = _this.value[key];
      defineProp(_this.value, key, {
        enumerable: true,
        configurable: true,
        value: temp
      });
    });

    Reflect.deleteProperty(_this.value, GV.PORTAL_PROPERTY_IDENTIFIER);
  };

  ReactiveProperty.prototype.setValue = function (value) {
    if (value === this.value) {
      return;
    }

    this.oldValue = value;
    this.value = value;
    this.syncNodes(value);
    this.syncStructure(value);
  };

  ReactiveProperty.prototype.syncNodes = function (value) {
    const oldValue = this.oldValue;

    if (value instanceof Array) {
      let change = GV.createActiveArray(value, this.update.bind(this));
      change.type = 'reset';
      change.result = oldValue;
      this.update(change, { original: oldValue });
      Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue, this.portal);
    } else {
      let i = 0, len = this.nodes.length;
      for (; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue);
      }
      Galaxy.GalaxyObserver.notify(this.portal, this.name, value, oldValue, this.portal);
    }
  };

  ReactiveProperty.prototype.syncStructure = function (value) {
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
    if (this.value instanceof Array) {
      // Ignore when the value is type of array because the value will take care of the changes itself
    } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setUpdateFor(this.nodes[i], this.keys[i], this.value, this.oldValue);
      }
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
   */
  ReactiveProperty.prototype.setValueFor = function (host, attributeName, value, oldValue) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      if (!host.setters[attributeName]) {
        return console.info(host, attributeName, value);
      }

      host.setters[attributeName](value, oldValue);
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
      // TODO: Find out why you need a notify here
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges, this);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   */
  ReactiveProperty.prototype.concat = function (property) {
    // TODO: only concat uniques
    const _this = this;
    this.nodes.forEach(function (node, i) {

    });

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
    this.placeholderFor = value;
    const valuePortal = value[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    const valueStructure = valuePortal.self.structure;
    const valueRefs = valuePortal.refs;
    const oldKeys = Object.keys(_this.structure);
    const currentStructurePortalRefs = _this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER].refs;
    debugger
    _this.sp = _this.value[GV.PORTAL_PROPERTY_IDENTIFIER];
    _this.unbindValue();
    // debugger;
    valuePortal.self.concat(_this);

    oldKeys.forEach(function (key) {
      if (valueRefs[key]) {
        valueRefs[key].concat(currentStructurePortalRefs[key]);
      } else if (currentStructurePortalRefs[key]) {
        const cloned = currentStructurePortalRefs[key].clone(valuePortal);
        cloned.value = value[key];
        valuePortal.setProperty(cloned, key);
        if (!valueStructure[key]) {
          defineProp(valueStructure, key, Object.getOwnPropertyDescriptor(_this.structure, key));
        }

        defineProp(value, key, Object.getOwnPropertyDescriptor(_this.structure, key));
      }

      // valuePortal.refs[key].syncNodes(value[key]);
    });
    debugger;
    valuePortal.self.notify(this);
  };

  ReactiveProperty.prototype.removePlaceholder = function () {
    if (!this.placeholderFor) {
      return;
    }

    const _this = this;
    const placeholderPortal = this.placeholderFor[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    debugger
    placeholderPortal.removeParent(_this);
    const keys = Object.keys(this.placeholderFor);
    // debugger;
    placeholderPortal.self.removeNodesByProperty(_this);

    // TODO structure and value structure are different
    const structureRefs = this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER].refs;
    // debugger;
    GV.setPortalFor(_this.value, this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER]);
    keys.forEach(function (key) {
      if (placeholderPortal.refs[key]) {
        placeholderPortal.refs[key].removeNodesByProperty(structureRefs[key]);
      }

      defineProp(_this.value, key, Object.getOwnPropertyDescriptor(_this.structure, key));
    });
    debugger
    this.placeholderFor = null;
  };

  return ReactiveProperty;

})();
