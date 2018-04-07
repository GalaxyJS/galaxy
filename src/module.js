/* global Galaxy */
'use strict';

Galaxy.GalaxyModule = /** @class */ (function () {

  /**
   *
   * @param {Object} module
   * @param {string} source
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

  GalaxyModule.prototype = {
    init: function () {
      this.scope.trigger('module.init');
    },

    start: function () {
      this.scope.trigger('module.start');
    },

    destroy: function () {
      this.scope.trigger('module.destroy');
    },

    registerAddOn: function (id, object) {
      this.addOns[id] = object;
    }
  };

  return GalaxyModule;
}(Galaxy || {}));
