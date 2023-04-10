/* global Galaxy */
Galaxy.Module = /** @class */ (function () {

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

    addAddOn: function (addOnProvider) {
      const h = addOnProvider.handler;
      this.addOnProviders[addOnProvider.name] = h;
      this.addOns[addOnProvider.name] = h.provideInstance(this.scope, this);
    }
  };

  return Module;
})();

Galaxy.Module.Content = /** @class */ (function () {
  const parsers = {};

  /**
   *
   * @param {Galaxy.Module.Content} ModuleContent
   * @returns {*}
   */
  Content.parse = function (ModuleContent) {
    const safeType = (ModuleContent.type || '').split(';')[0];
    const parser = parsers[safeType];

    if (parser) {
      return parser.call(null, ModuleContent.content, ModuleContent.metaData);
    }

    return parsers['default'].call(null, ModuleContent.content, ModuleContent.metaData);
  };

  /**
   *
   * @param {string} type
   * @param {function} parser
   */
  Content.registerParser = function (type, parser) {
    parsers[type] = parser;
  };

  /**
   *
   * @param {string} type
   * @param {*} content
   * @param {*} metaData
   * @constructor
   * @memberOf Galaxy.Module
   */
  function Content(type, content, metaData) {
    this.type = type;
    this.content = content;
    this.metaData = metaData;
  }

  Content.prototype = {};

  return Content;
})();
