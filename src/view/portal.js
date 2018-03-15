/* global Galaxy */

Galaxy.GalaxyView.Portal = /** @class */(function () {
  const GV = Galaxy.GalaxyView;

  /**
   * @param {Galaxy.GalaxyView.ReactiveProperty} self
   * @constructor
   */
  function Portal() {
    /** @type Galaxy.GalaxyView.ReactiveProperty */
    this.parents = [];
    this.refs = {};
    this.self = null;
  }

  Portal.prototype.setSelf = function (self) {
    this.removeParent(self);

    this.self = self;
    this.addParent(self);
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
    const keys = Object.keys(this.refs);
    let i = 0;

    for (const len = keys.length; i < len; i++) {
      list.push(this.refs[keys[i]]);
    }

    return list;
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveProperty} property
   */
  Portal.prototype.setProperty = function (property, key, name, refs) {
    if (name) {
      // _this.
      GV.defineProp(this.refs, key, {
        configurable: true,
        enumerable: true,
        get: function dynamicRef() {
          return refs[name];
        }
      });

      this.refs[key] = 'test';
    } else {
      this.refs[key] = property;
    }
  };

  Portal.prototype.getValueOf = function (key) {
    const prop = this.refs[key];

    return prop ? prop.value : undefined;
  };

  Portal.prototype.setValue = function (value, scope) {
    const props = this.getPropertiesList();
    let i = 0, len = props.length;
    for (; i < len; i++) {
      props[i].setValue(value, scope);
    }
  };

  return Portal;
}());
