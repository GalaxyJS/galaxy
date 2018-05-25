/* global Galaxy */

(function () {
  /**
   *
   * @returns {Galaxy.GalaxyModule}
   */
  Galaxy.GalaxyModule = GalaxyModule;

  /**
   *
   * @param {Object} module
   * @param {Galaxy.GalaxyScope} scope
   * @constructor
   */
  function GalaxyModule(module, scope) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.url = module.url || null;
    this.addOns = module.addOns || {};
    this.domain = module.domain;
    this.scope = scope;
  }

  GalaxyModule.prototype.init = function () {
    for (var key in this.addOns) {
      var addOn = this.addOns[key];
      if (typeof addOn.onModuleInit === 'function') {
        addOn.onModuleInit();
      }
    }
  };

  GalaxyModule.prototype.start = function () {
    for (var key in this.addOns) {
      var addOn = this.addOns[key];
      if (typeof addOn.onModuleStart === 'function') {
        addOn.onModuleStart();
      }
    }
  };

  GalaxyModule.prototype.registerAddOn = function (id, object) {
    this.addOns[id] = object;
  };
}());
