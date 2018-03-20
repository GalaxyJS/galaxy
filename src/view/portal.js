/* global Galaxy */

Galaxy.GalaxyView.Portal = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;

  /**
   * @constructor
   */
  function Portal() {
    /** @type Galaxy.GalaxyView.ReactiveProperty */
    this.parents = [];
    this.props = {};
  }

  Portal.prototype.notify = function (key, value) {
    const props = this.getPropsByKey(key);
    props.forEach(function (prop) {
      prop.notify(value);
    });
  };

  Portal.prototype.getPropsByKey = function (key) {
    const properties = [];
    this.parents.forEach(function (parent) {
      const prop = parent.getProperty(key);
      if (prop) {
        properties.push(prop);
      }
    });

    return properties;
  };

  Portal.prototype.setupProp = function (structure, key, value) {
    const _this = this;
    let _value = value;

    Object.defineProperty(structure, key, {
      get: function () {
        return _value;
      },
      set: function (newValue) {
        _value = newValue;
        _this.notify(key);
        _this.notifyParents();
      },
      enumerable: false,
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
   */
  Portal.prototype.addParent = function (owner) {
    if (this.parents.indexOf(owner) === -1) {
      this.parents.push(owner);
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

  Portal.prototype.clone = function () {
    const clone = new Portal();
    clone.props = Object.assign({}, this.props);
    let prop, cloneProp;
    for (let key in this.props) {
      prop = this.props[key];
      cloneProp = prop.clone(clone);
      cloneProp.value = prop.value;
      clone.setProperty(cloneProp, key);
    }

    return clone;
  };

  return Portal;
}());
