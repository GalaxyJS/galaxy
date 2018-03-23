/* global Galaxy */

Galaxy.GalaxyView.ReactiveProperty = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
  const defineProp = Object.defineProperty;

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
    // Shadow values are also representing their structure.
    // If detected, we will define this property structure with the value, so any changes to the value
    // will also be reflected on structure and they will stay in sync. This means that from this point further,
    // value is not shadow anymore
    if (value && value.__shadow__ === true) {
      Reflect.deleteProperty(value, '__shadow__');
      if (value instanceof Array) {
        if (value.hasOwnProperty('_length')) {
          Object.defineProperties(this.structure, Object.getOwnPropertyDescriptor(value, '_length'));
        }
        GV.setPortalFor(this.structure, value[GV.PORTAL_PROPERTY_IDENTIFIER]);
      } else {
        Object.defineProperties(this.structure, Object.getOwnPropertyDescriptors(value));
      }
    } else {
      GV.initPortalFor(this.structure);
    }

    // If value has portal then it's already reactive and this property should be added as a parent for value
    if (value && value[GV.PORTAL_PROPERTY_IDENTIFIER]) {
      const valuePortal = value[GV.PORTAL_PROPERTY_IDENTIFIER];
      valuePortal.addParent(this);
    } else if (value instanceof Array) {
      GV.setPortalFor(value, this.structure[GV.PORTAL_PROPERTY_IDENTIFIER]);
      this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].addParent(this);
    }

    GV.makeReactive(value, this);

    this.value = value;
  };

  ReactiveProperty.prototype.getPlaceholders = function () {
    const _this = this;
    // Arrays will be also in parents but they don't have the structure for value so they should be ignored
    return this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents.filter(function (parent) {
      let isInterlinked = parent.nodes.some(function (node) {
        return node.__portal__ === _this.portal;
      });

//       isInterlinked = isInterlinked || _this.nodes.some(function (node) {
//         return node.__portal__ === parent.portal;
//       });
// debugger;
      return !(parent.value instanceof Array) && !isInterlinked;
    });
  };

  ReactiveProperty.prototype.getParents = function () {
    return this.portal.parents;
  };

  ReactiveProperty.prototype.getProperty = function (key) {
    return this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].props[key];
  };

  ReactiveProperty.prototype.unbindValue = function () {
    const _this = this;
    if (!_this.value || typeof _this.value !== 'object') {
      return;
    }

    // this.unbindValue();
    // If there is a copy, then use the structure of that copy
    // because that copy still has the old value
    const copy = this.getPlaceholders()[0];
    // debugger;
    if (copy) {
      return Object.defineProperties(_this.value, Object.getOwnPropertyDescriptors(copy.structure));
    } else {
      GV.toShadow(_this.value);
    }

    const currentValuePortal = _this.value[GV.PORTAL_PROPERTY_IDENTIFIER];
    if (!currentValuePortal) {
      return;
    }
    // debugger;
    _this.value[GV.PORTAL_PROPERTY_IDENTIFIER] = currentValuePortal.clone(true);
    // _this.value[GV.PORTAL_PROPERTY_IDENTIFIER].parents = currentValuePortal.parents.slice(0);

    // const oldKeys = objKeys(_this.value);
    // oldKeys.forEach(function (key) {
    //   const temp = _this.value[key];
    //   defineProp(_this.value, key, {
    //     enumerable: true,
    //     configurable: true,
    //     value: temp
    //   });
    // });
    //
    // Reflect.deleteProperty(_this.value, GV.PORTAL_PROPERTY_IDENTIFIER);
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
      debugger;
      console.error('no array', this);
      // ReactiveProperty.installParentFor(this.value, this);
      // const init = GV.createActiveArray(this.value, this.update.bind(this),this);
      // if (target instanceof GV.ViewNode) {
      //   this.setUpdateFor(target, key, init);
      // }
    } else {
      this.setValueFor(target, key, this.value, this.oldValue);
    }
  };

  ReactiveProperty.prototype.setValue = function (value) {
    if (value === this.value) {
      return;
    }

    this.oldValue = this.value;
    this.value = value;
    this.syncNodes(value);
    this.syncStructure(value);
  };

  ReactiveProperty.prototype.setValueChange = function (changes, oldChanges) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        // debugger;
        GV.installParentFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        GV.uninstallParentFor([changes.result], this);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        GV.uninstallParentFor(changes.result, this);
      }
    }

    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setValueFor(this.nodes[i], this.keys[i], changes, oldChanges);
    }
  };

  ReactiveProperty.prototype.syncNodes = function (value) {
    const oldValue = this.oldValue;

    if (value instanceof Array) {
      // if (!value['reactive']) {
        GV.createActiveArray(value, this.portal, this);
      // } else {
      //   GV.createActiveArray(value, this.portal);
      //   // console.error('no array', this);
      // }

      // let change = GV.createActiveArray(value, this.update.bind(this));
      // change.type = 'reset';
      // change.result = oldValue;
      // this.update(change, { original: oldValue });
      // Galaxy.GalaxyObserver.notify(this.portal, this.name, change, oldValue);
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
    // debugger;
    if (value === null || value === undefined) {
      keys.forEach(function (key) {
        props[key].setValue(undefined);
      });
    }
    else {
      keys.forEach(function (key) {
        // if (value[key] instanceof Array) {
        //   return;
        // }
        if (props[key]) {
          props[key].setValue(value[key]);
        }
      });
    }
  };

  ReactiveProperty.prototype.syncUI = function () {
    if (this.value instanceof Array) {
      // Ignore when the value is type of array because the value will take care of the changes itself
      debugger;
      // return;
    }

    for (let i = 0, len = this.nodes.length; i < len; i++) {
      this.setUpdateFor(this.nodes[i], this.keys[i], this.value, this.oldValue);
    }
  };

  ReactiveProperty.prototype.notify = function (value) {
    const _this = this;

    if (value !== null && typeof value === 'object') {
      if (value.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
        debugger;
        const structurePortal = _this.structure[GV.PORTAL_PROPERTY_IDENTIFIER];
        // structurePortal.parents = value[GV.PORTAL_PROPERTY_IDENTIFIER].parents;
        // structurePortal.addParent(_this);
        value[GV.PORTAL_PROPERTY_IDENTIFIER].addParent(_this, value instanceof Array);
        console.log(this.value === value);
        const valuePortalProps = value[GV.PORTAL_PROPERTY_IDENTIFIER].props;
        debugger;
        for (let k in valuePortalProps) {
          let oP = valuePortalProps[k];
          if (!structurePortal.props.hasOwnProperty(k)) {
            const nP = oP.clone(structurePortal, true);
            nP.value = oP.value;
            structurePortal.setProperty(nP, k);
            // nP.setValue(oP.value);
          }
        }
        debugger;
        // console.log(this.value === value);
        // debugger;
      } else {
        // debugger;
        return this.reCreateFor(value);
      }
    }
    const parents = this.getParents();
    debugger;
    this.setValue(value);
    debugger;
    parents.forEach(function (parent) {
      // console.info('parent.value - is array?', parent.value instanceof Array);
      parent.syncUI();
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
      // if (!host.setters[attributeName]) {
      //   return console.info(host, attributeName, value);
      // }

      host.setters[attributeName](value, oldValue);
    } else {
      // debugger;
      GV.getPortal(host).notify(attributeName, value);
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
      if (GV.REACTIVE_BEHAVIORS.hasOwnProperty(attributeName) && changes instanceof Array) {
        // console.warn('value is array, reactive behavior ignored, ', attributeName);
        // We don't pass changes to the reactive properties because
        // they are responsible to handle the data changes themselves
        return;
      }
      host.setters[attributeName](changes, oldChanges);
    } else {
      Galaxy.GalaxyObserver.notify(host, attributeName, changes, oldChanges, this);
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

  ReactiveProperty.prototype.isolate = function () {
    const parents = this.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents;
    if (parents.indexOf(this) !== -1) {
      parents.splice(parents.indexOf(this), 1);
    }

    // let interlinks = this.nodes.filter(function (node) {
    //   return !(node instanceof GV.ViewNode);
    // });
    //
    // interlinks.forEach(function (interlink) {
    //   parents
    // });

    // remove interlinks
    // debugger;

    this.unbindValue();
  };

  ReactiveProperty.prototype.reCreateFor = function (value) {
    // debugger;
    this.isolate();
    // debugger;
    // let cache = this.value
    // let p = GV.getPortal(value)
    // debugger;
    this.initValue(value);
    this.syncNodes(value);
    this.syncStructure(value);
    // debugger;
    // debugger
    // this.setValue(value);
    // console.info(cache[GV.PORTAL_PROPERTY_IDENTIFIER] === structure[GV.PORTAL_PROPERTY_IDENTIFIER]);
    const structure = this.structure;
    // in the case where an object is bound to this property
    if (value.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
      GV.getPortal(value).addParent(this, value instanceof Array);
      // debugger;
    } else {
      const newPortal = structure[GV.PORTAL_PROPERTY_IDENTIFIER].clone();
      newPortal.addParent(this, value instanceof Array);
      GV.setPortalFor(structure, newPortal);
      Object.defineProperties(value, Object.getOwnPropertyDescriptors(structure));
      // debugger;
    }
  };

  return ReactiveProperty;

})();
