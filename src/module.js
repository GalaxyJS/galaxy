/* global Galaxy */
'use strict';

(function (G) {

  /**
   *
   * @type {Galaxy.GalaxyModule}
   */
  G.GalaxyModule = GalaxyModule;

  /**
   *
   * @param {Object} module
   * @param {Galaxy.GalaxyScope} scope
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxyModule(module, source, scope) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.source = source;
    this.url = module.url || null;
    this.importId = module.importId || module.url;
    this.addOns = module.addOns || {};
    this.domain = module.domain;
    this.addOnProviders = [];
    this.scope = scope;
  }

  GalaxyModule.prototype.init = function () {
    this.scope.trigger('module.init');
  };

  GalaxyModule.prototype.start = function () {
    this.scope.trigger('module.start');
  };

  GalaxyModule.prototype.destroy = function () {
    this.scope.trigger('module.destroy');
  };

  GalaxyModule.prototype.registerAddOn = function (id, object) {
    this.addOns[id] = object;
  };
}(Galaxy || {}));
