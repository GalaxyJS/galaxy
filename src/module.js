/* global Galaxy */
(function (_galaxy) {
  'use strict';
  /**
   *
   * @param {object} module
   * @param {Galaxy.Scope} scope
   * @param {string} source
   * @param {boolean} native
   * @constructor
   * @memberOf Galaxy
   */
  function Module(module, scope, source, native) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.source = source;
    this.path = module.path || null;
    this.importId = module.importId || module.path;
    this.addOns = module.addOns || {};
    this.addOnProviders = {};
    this.scope = scope;
    this.native = native || false;
  }

  Module.prototype = {
    init: function () {
      const providers = this.addOnProviders;
      Reflect.deleteProperty(this, 'source');
      Reflect.deleteProperty(this, 'addOnProviders');

      for (let addOnName in this.addOns) {
        providers[addOnName].startInstance(this.addOns[addOnName], this);
      }

      this.scope.trigger('module.init');
    },

    start: function () {
      this.scope.trigger('module.start');
    },

    destroy: function () {
      this.scope.trigger('module.destroy');
    },
  };

  _galaxy.Module = Module;
})(Galaxy);
