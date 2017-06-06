/* global Galaxy */

(function (root, G) {

  root.Galaxy = G;
  /**
   *
   * @returns {Galaxy.GalaxyModule}
   */
  G.GalaxyModule = GalaxyModule;

  /**
   *
   * @param {Object} module
   * @param {Galaxy.GalaxyScope} scope
   * @constructor
   */
  function GalaxyModule(module, source, scope, view) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.source = source;
    this.url = module.url || null;
    this.addOns = module.addOns || {};
    this.domain = module.domain;
    this.addOnProviders = [];

    this.scope = scope;
    this.view = view;
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
}(this, Galaxy || {}));
