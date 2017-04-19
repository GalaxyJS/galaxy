(function () {
  /**
   *
   * @returns {Galaxy.GalaxyStateHandler}
   */
  Galaxy.GalaxyModule = GalaxyModule;

  function GalaxyModule(module, scope) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.url = module.url || null;
    this.services = module.services || {};
    this.domain = module.domain;
    this.scope = scope;
  }

  GalaxyModule.prototype.init = function () {
    for (var key in this.services) {
      var service = this.services[key];
      if (typeof service.onModuleInit === 'function') {
        service.onModuleInit();
      }
    }
  };

  GalaxyModule.prototype.start = function () {
    for (var key in this.services) {
      var service = this.services[key];
      if (typeof service.onModuleStart === 'function') {
        service.onModuleStart();
      }
    }
  };
}());
