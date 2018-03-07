/* global Galaxy */

Galaxy.GalaxyView.Portal = /** @class */(function () {
  /**
   *
   * @constructor
   */
  function Portal() {
    /** @type Galaxy.GalaxyView.ReactiveProperty */
    this.parents = [];
    this.props = {};
  }

  //
  // Portal.prototype.setOwner = function (owner) {
  //   if (owner) {
  //     this.removeOwner(this.owner);
  //   }
  //
  //   this.owner = owner;
  // };

  Portal.prototype.getParents = function () {
    if (this.owner) {
      return this.parents.concat(this.owner);
    }
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
   */
  Portal.prototype.setProperty = function (property, key) {
    this.props[key] = property;
  };

  Portal.prototype.getValueOf = function (key) {
    const prop = this.props[key];

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
