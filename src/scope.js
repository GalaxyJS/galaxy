(function () {
  /**
   *
   * @returns {Galaxy.GalaxyScope}
   */
  Galaxy.GalaxyScope = GalaxyScope;

  function GalaxyScope (module, html, views) {
    this.systemId = module.systemId;
    this.parentScope = module.parentScope || null;
    this.html = html;
    this.views = views;
    this.imports = {};
  }

  GalaxyScope.prototype.loadModuleInto = function (module, view) {
    module.parentScope = this;
    Galaxy.load(module, function (module) {
      Galaxy.ui.setContent(view, module.scope.html);

      module.trigger('start');
    });
  };

}());
