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
    this.installModules = [];
  }

  GalaxyModule.prototype.init = function (installLibs) {
    var _this = this;

    _this.installModules = installLibs || [];
    _this.installModules.forEach(function (lib) {
      _this.domain.loadModule(lib);
    });
  };

  GalaxyModule.prototype.start = function () {
    for (var key in this.services) {
      var service = this.services[key];
      if (typeof service.start === 'function') {
        service.start();
      }
    }
  };
}());
