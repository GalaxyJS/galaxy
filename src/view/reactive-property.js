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
  function ReactiveProperty(portal, name) {
    const _this = this;
    _this.name = name;

    _this.oldValue = undefined;
    _this.value = undefined;

    /** @type {Galaxy.GalaxyView.Portal} */
    _this.portal = portal;

    _this.keys = [];
    _this.nodes = [];

    _this.placeholderFor = null;
    // Holds the structure of bindings
    _this.structure = {};

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

  ReactiveProperty.prototype.initValue = function (value) {
    GV.initPortalFor(this.structure);

    if (value && value[GV.PORTAL_PROPERTY_IDENTIFIER]) {
      const valuePortal = value[GV.PORTAL_PROPERTY_IDENTIFIER];
      valuePortal.addParent(this);
      this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents = valuePortal.parents;
      // GV.setPortalFor(this.structure, valuePortal);
    }

    this.value = value;
  };

  ReactiveProperty.prototype.getPlaceholders = function () {
    // Arrays will be also in parents but they don't have the structure for value so they should be ignored
    return this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents.filter(function (parent) {
      return !(parent.value instanceof Array);
    });
  };

  ReactiveProperty.prototype.getParents = function () {
    return this.portal.parents;
  };

  ReactiveProperty.prototype.getProperty = function (key) {
    return this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].props[key];
  };

  ReactiveProperty.prototype.allNodes = function (alias) {
    const key = alias || this.name;
    const clones = [];
    this.portal.parents.forEach(function (parent) {
      const prop = parent.getProperty(key);
      if (prop) {
        clones.push(prop);
      }
    });

    return clones;
  };

  ReactiveProperty.prototype.unbindValue = function () {
    const _this = this;
    if (!_this.value || typeof _this.value !== 'object') {
      return;
    }

    // If there is a copy, then use that structure of that copy
    // because that copy still has the old value
    const copy = this.getPlaceholders()[0];
    if (copy) {
      return Object.defineProperties(_this.value, Object.getOwnPropertyDescriptors(copy.structure));
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

  ReactiveProperty.prototype.reactivate = function () {
    if (this.placeholderFor.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
      return;
    }

    const portal = this.structure[Galaxy.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    GV.setPortalFor(this.placeholderFor, portal);
    const _this = this;
    const keys = Object.keys(this.placeholderFor);
    keys.forEach(function (key) {
      if (portal.props[key]) {
        defineProp(_this.placeholderFor, key, Object.getOwnPropertyDescriptor(_this.structure, key));
      }
    });
  };

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
      this.update(change, {original: oldValue});
      Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue);
    } else {
      let i = 0, len = this.nodes.length;
      for (; i < len; i++) {
        this.setValueFor(this.nodes[i], this.keys[i], value, oldValue);
      }
      Galaxy.GalaxyObserver.notify(this.portal, this.name, value, oldValue);
    }
  };

  ReactiveProperty.prototype.syncStructure = function (value) {
    const _this = this;
    const keys = objKeys(_this.structure);
    const props = _this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].props;
    console.info(_this.value[GV.PORTAL_PROPERTY_IDENTIFIER] === _this.structure[GV.PORTAL_PROPERTY_IDENTIFIER]);
    debugger
    if (value === null || value === undefined) {
      keys.forEach(function (key) {
        props[key].setValue(undefined);
      });
    }
    else {
      keys.forEach(function (key) {
        props[key].setValue(value[key]);
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

  ReactiveProperty.prototype.sync = function () {
    debugger;
    // if (this.value instanceof Array) {
    //   // Ignore when the value is type of array because the value will take care of the changes itself
    // } else {
      for (let i = 0, len = this.nodes.length; i < len; i++) {
        this.setUpdateFor(this.nodes[i], this.keys[i], this.value, this.oldValue);
      }
    // }
  };

  ReactiveProperty.prototype.notify = function (value, key) {
    const _this = this;
    const placeholders = this.getPlaceholders();

    if (value !== null && typeof value === 'object') {
      if (value.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
        const structurePortal = _this.structure[GV.PORTAL_PROPERTY_IDENTIFIER];
        structurePortal.parents = value[GV.PORTAL_PROPERTY_IDENTIFIER].parents;
        structurePortal.addParent(_this);
        console.log(this.value === value);
        const valuePortalProps = value[GV.PORTAL_PROPERTY_IDENTIFIER].props;

        for (let k in valuePortalProps) {
          let oP = valuePortalProps[k];
          if (!structurePortal.props.hasOwnProperty(k)) {
            const nP = oP.clone(structurePortal, true);
            nP.value = oP.value;
            structurePortal.setProperty(nP, k);
          }
        }
        console.log(this.value === value);
        debugger;
      } else {
        debugger;
        this.removePlaceholder();
        this.unbindValue();
        this.setValue(value);
        const portalClone = this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].clone();
        portalClone.addParent(_this);
        GV.setPortalFor(this.structure, portalClone);
        debugger;
        return Object.defineProperties(value, Object.getOwnPropertyDescriptors(this.structure));
      }
    }
    const parents = this.getParents();
    debugger;
    this.setValue(value);
    debugger;
    parents.forEach(function (parent) {
      parent.sync(parent.value);
      parent.syncStructure(parent.value);
    });

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
      // if (changes && changes.original) {
      //   debugger;
      // host[attributeName] = changes.original;
      // } else
      // Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges, this);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   */
  ReactiveProperty.prototype.concat = function (property) {
    // TODO: only concat uniques
    // const _this = this;
    this.nodes.forEach(function (node, i) {

    });

    this.nodes = this.nodes.concat(property.nodes);
    this.keys = this.keys.concat(property.keys);
  };

  ReactiveProperty.prototype.clone = function (portal, clean) {
    const clone = new Galaxy.GalaxyView.ReactiveProperty(portal, this.name);
    clone.structure = this.structure;

    if (!clean) {
      clone.concat(this);
    }

    return clone;
  };

  ReactiveProperty.prototype.removePlaceholder = function () {
    const parents = this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents;
    if (parents.indexOf(this) !== -1) {
      parents.splice(parents.indexOf(this), 1);
    }
  };

  return ReactiveProperty;

})();
