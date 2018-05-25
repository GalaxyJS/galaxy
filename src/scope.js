/* global Galaxy */

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

    var urlParser = document.createElement('a');
    urlParser.href = module.url;
    var myRegexp = /([^\t\n]+)\//g;
    var match = myRegexp.exec(urlParser.pathname);
    this.path = match[ 0 ];
  }

  GalaxyScope.prototype.load = function (module, onDone) {
    module.parentScope = this;
    module.domain = module.domain || Galaxy;
    Galaxy.load(module, onDone);
  };

  GalaxyScope.prototype.loadModuleInto = function (module, view) {
    if (module.url.indexOf('./') === 0) {
      module.url = this.path + module.url.substr(2);
    }

    this.load(module, function (module) {
      Galaxy.ui.setContent(view, module.scope.html);

      module.start();
    });
  };

}());
