(function () {
  /**
   *
   * @returns {Galaxy.GalaxyStateHandler}
   */
  Galaxy.GalaxyModule = GalaxyModule;

  function GalaxyModule (module, scope) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.url = module.url || null;
    this.services = module.services || {};
    this.domain = module.domain;
    this.scope = scope;
    this.installModules = [];
    this.eventHandlers = [];
  }

  GalaxyModule.prototype.init = function (installLibs) {
    var _this = this;

    _this.installModules = installLibs || [];
    _this.installModules.forEach(function (lib) {
      _this.domain.loadModule(lib);
    });
  }

  GalaxyModule.prototype.on = function (event, handler) {
    this.eventHandlers.push({
      event: event,
      handler: handler
    });
  };

  GalaxyModule.prototype.trigger = function (event) {
    var handlers = this.eventHandlers.filter(function (item) {
      return item.event === event;
    });

    handlers.forEach(function (item) {
      item.handler();
    });
  };
}());
