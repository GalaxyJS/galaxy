/* global Galaxy */

Galaxy.GalaxyView.Portal = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;

  /**
   * @constructor
   */
  function Portal(data) {
    if (data && data.hasOwnProperty(GV.PORTAL_PROPERTY_IDENTIFIER)) {
      return data[GV.PORTAL_PROPERTY_IDENTIFIER];
    }

    /** @type Galaxy.GalaxyView.ReactiveProperty */
    this.parents = [];
    this.props = {};
  }

  Portal.prototype.notify = function (key, value) {
    const props = this.getPropertiesByKey(key);

    let valuePortal;
    // if (value && value[GV.PORTAL_PROPERTY_IDENTIFIER]) {
    //   valuePortal = value[GV.PORTAL_PROPERTY_IDENTIFIER];
    //   // TODO: Add this portal to the valuePortal
    // }

    if (value instanceof Array) {
      // Make the array reactive if it's not
      // TODO: if key has a value, this portal should be removed from it
      // valuePortal = new Portal(value);
      // value.forEach(function (item) {
      //   props.forEach(function (prop) {
      //     item[GV.PORTAL_PROPERTY_IDENTIFIER].addParent(prop);
      //   });
      // });
    } else if (value instanceof Object) {
      // Make object reactive if it's not
      // TODO: if key has a value, this portal should be removed from it
      // valuePortal = new Portal(value);
      // props.forEach(function (prop) {
      //   let oldPortalShadowPortal = prop.structure[GV.PORTAL_PROPERTY_IDENTIFIER];
      //   oldPortalShadowPortal.removeParent(props[key]);
      // });
    }

    props.forEach(function (prop) {
      prop.notify(value);
    });
  };

  Portal.prototype.update = function (changes, oldChanges, newProperty) {
    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        GV.installParentFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        GV.uninstallParentFor([changes.result], this);
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        GV.uninstallParentFor(changes.result, this);
      }
    }

    if (newProperty) {
      return newProperty.setValueChange(changes, oldChanges);
    }

    for (let i = 0, len = this.parents.length; i < len; i++) {
      this.parents[i].setValueChange(changes, oldChanges);
    }
  };

  Portal.prototype.getPropertiesByKey = function (key) {
    const properties = [];
    this.parents.forEach(function (parent) {
      const prop = parent.getProperty(key);
      if (prop) {
        properties.push(prop);
      }
    });

    return properties;
  };

  // Portal.prototype.observe = function (data) {
  //   for (let key in data) {
  //     this.setupProp(data, key);
  //   }
  // };
  //
  Portal.prototype.setupProp = function (structure, key) {
    const _this = this;
    let _value = structure[key];

    Object.defineProperty(structure, key, {
      get: function () {
        return _value;
      },
      set: function (newValue) {
        _value = newValue;
        _this.notify(key);
      },
      enumerable: true,
      configurable: true
    });
  };

  Portal.prototype.getParents = function () {
    return this.parents;
  };

  Portal.prototype.getParents = function () {
    return this.parents;
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} owner
   * @param {boolean} inIsolation
   */
  Portal.prototype.addParent = function (owner, inIsolation,data) {
    if (this.parents.indexOf(owner) === -1) {
      this.parents.push(owner);
    }

    if (!inIsolation) {
      owner.structure[GV.PORTAL_PROPERTY_IDENTIFIER].parents = this.parents;
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} owner
   */
  Portal.prototype.removeParent = function (owner) {
    let index = this.parents.indexOf(owner);
    if (index !== -1) {
      this.parents.splice(index, 1);
    }
  };

  /**
   *
   * @return {Array<Galaxy.GalaxyView.ReactiveProperty>}
   */
  Portal.prototype.getPropertiesList = function () {
    let list = [];
    const keys = Object.keys(this.props);
    let i = 0;

    for (const len = keys.length; i < len; i++) {
      list.push(this.props[keys[i]]);
    }

    return list;
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   * @param {string} key
   */
  Portal.prototype.setProperty = function (property, key) {
    this.props[key] = property;
  };

  Portal.prototype.getValueOf = function (key) {
    const prop = this.props[key];

    return prop ? prop.value : undefined;
  };

  Portal.prototype.clone = function (clean) {
    const clone = new Portal();
    clone.props = {};
    let prop, cloneProp;
    for (let key in this.props) {
      prop = this.props[key];
      cloneProp = prop.clone(clone, clean);
      cloneProp.value = prop.value;
      clone.setProperty(cloneProp, key);
    }

    return clone;
  };

  /**
   *
   * @param data
   * @param {Galaxy.GalaxyView.ReactiveProperty} parent
   */
  Portal.prototype.prepare = function (data) {
    const _this = this;
    if (data instanceof Array) {
      data.forEach(function (item) {
        // We don't want to use array indexes as keys or make array indexes reactive for that matter
        // So we add the array as a parent, for each of its item.
        // This will cause that the array items will be orphan
        _this.prepare(item);
        // GalaxyView.getPortal(item).addParent(parent, true);
      });
    } else if (data !== null && typeof data === 'object') {
      let initValuePortal;
      let structure = null;
      if (!parent) {
        initValuePortal = _this.getPortal(data);
      } else {
        initValuePortal = _this.getPortal(parent.structure);
        initValuePortal.addParent(parent);
        structure = parent.structure;
      }

      for (let key in data) {
        if (data.hasOwnProperty(key) && !initValuePortal.props.hasOwnProperty(key)) {
          _this.setupProperty(structure, key, {
            enumerable: true,
            valueScope: data,
            initValue: data[key]
          });
        }
      }
    }
  };

  return Portal;
}());
