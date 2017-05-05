/* global Galaxy, Promise */

(function (root) {
  root.Galaxy = new Core();

  /** The main class of the GalaxyJS. window.galaxy is an instance of this class.
   *
   * @returns {Galaxy.GalaxySystem}
   */
  Galaxy.GalaxyCore = Core;

  var importedLibraries = {};

  function Core () {
    this.bootModule = null;
    this.modules = {};
    this.onLoadQueue = [];
    this.onModuleLoaded = {};
    this.addOnProviders = [];
    this.app = null;
    this.rootElement = null;
  }

  Core.prototype.extends = function (child, parent) {
    var hasProp = {}.hasOwnProperty;
    for (var key in parent) { if (hasProp.call(parent, key)) child[ key ] = parent[ key ]; }
    function ctor () { this.constructor = child; }

    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.__super__ = parent.prototype;
    return child;
  };

  Core.prototype.boot = function (bootModule, rootElement) {
    var _this = this;
    _this.rootElement = rootElement;

    bootModule.domain = this;
    bootModule.id = 'system';

    var promise = new Promise(function (resolve, reject) {
      _this.load(bootModule).then(function (module) {
        // Replace galaxy temporary  bootModule with user specified bootModule
        _this.bootModule = module;
        resolve(module);
        // Start galaxy
        // _this.app = _this.bootModule.addOns[ 'galaxy/scope-state' ] || _this.app;
      });
    });

    return promise;
  };

  Core.prototype.convertToURIString = function (obj, prefix) {
    var _this = this;
    var str = [], p;
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        var k = prefix ? prefix + '[' + p + ']' : p, v = obj[ p ];
        str.push((v !== null && typeof v === 'object') ?
          _this.convertToURIString(v, k) :
          encodeURIComponent(k) + '=' + encodeURIComponent(v));
      }
    }

    return str.join('&');
  };

  Core.prototype.load = function (module) {
    var _this = this;
    var promise = new Promise(function (resolve, reject) {
      module.id = module.id || 'noid-' + (new Date()).valueOf() + '-' + Math.round(performance.now());
      module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

      root.Galaxy.onModuleLoaded[ module.systemId ] = resolve;
      var moduleExist = Galaxy.modules[ module.systemId ];

      var invokers = [ module.url ];
      if (module.invokers) {
        if (module.invokers.indexOf(module.url) !== -1) {
          throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
        }

        invokers = module.invokers;
        invokers.push(module.url);
      }

      if (moduleExist) {
        var ol = Galaxy.onModuleLoaded[ module.systemId ];
        if ('function' === typeof (ol)) {
          ol(moduleExist);
          delete Galaxy.onModuleLoaded[ module.systemId ];
        }

        return;
      }

      if (Galaxy.onLoadQueue[ module.systemId ]) {
        return;
      }

      Galaxy.onLoadQueue[ module.systemId ] = true;

      fetch(module.url + '?' + _this.convertToURIString(module.params || {})).then(function (response) {
        // var contentType = response.headers.get('content-type').split(';')[ 0 ] || 'text/html';
        response.text().then(function (moduleContent) {
          _this.compileModuleContent(module, moduleContent, invokers).then(function (module) {
            _this.executeCompiledModule(module);
          });
        });
      });
    });

    return promise;
  };

  Core.prototype.compileModuleContent = function (moduleMetaData, moduleContent, invokers) {
    var _this = this;
    var promise = new Promise(function (resolve, reject) {
      var doneImporting = function (module, imports) {
        imports.splice(imports.indexOf(module.url) - 1, 1);

        if (imports.length === 0) {
          // This will load the original initilizer
          resolve(module);
        }
      };

      var imports = [];
      // extract imports from the source code
      var moduleContentWithoutComments = moduleContent.replace(/\/\*[\s\S]*?\*\n?\/|([^:]|^)\n?\/\/.*\n?$/gm, '');
      moduleContent = moduleContentWithoutComments.replace(/Scope\.import\(['|"](.*)['|"]\)\;/gm, function (match, path) {
        var query = path.match(/([\S]+)/gm);
        imports.push({
          url: query[ query.length - 1 ],
          fresh: query.indexOf('new') !== -1
        });

        return 'Scope.imports[\'' + query[ query.length - 1 ] + '\']';
      });

      var scope = new Galaxy.GalaxyScope(moduleMetaData,
        moduleMetaData.parentScope ? moduleMetaData.parentScope.element || _this.rootElement : _this.rootElement);
      var view = new Galaxy.GalaxyView(scope);
      // Create module from moduleMetaData
      var module = new Galaxy.GalaxyModule(moduleMetaData, moduleContent, scope, view);
      Galaxy.modules[ module.systemId ] = module;

      if (imports.length) {
        var importsCopy = imports.slice(0);
        imports.forEach(function (item) {
          var moduleAddOnProvider = Galaxy.getModuleAddOnProvider(item.url);
          if (moduleAddOnProvider) {
            var providerStages = moduleAddOnProvider.handler.call(null, scope, module);
            var addOnInstance = providerStages.pre();
            importedLibraries[ item.url ] = {
              name: item.url,
              module: addOnInstance
            };

            module.registerAddOn(item.url, addOnInstance);
            module.addOnProviders.push(providerStages);

            doneImporting(module, importsCopy);
          } else if (importedLibraries[ item.url ] && !item.fresh) {
            doneImporting(module, importsCopy);
          } else {
            Galaxy.load({
              name: item.name,
              url: item.url,
              fresh: item.fresh,
              parentScope: scope,
              invokers: invokers,
              temporary: true
            }).then(function () {
              doneImporting(module, importsCopy);
            });
          }
        });

        return promise;
      }

      resolve(module);
    });

    return promise;
  };

  Core.prototype.executeCompiledModule = function (module) {
    for (var item in importedLibraries) {
      if (importedLibraries.hasOwnProperty(item)) {
        var asset = importedLibraries[ item ];
        if (asset.module) {
          module.scope.imports[ asset.name ] = asset.module;
        }
      }
    }

    var moduleSource = new Function('Scope', 'View', module.source);
    moduleSource.call(null, module.scope, module.view);

    delete module.source;

    module.addOnProviders.forEach(function (item) {
      item.post();
    });

    delete module.addOnProviders;

    if (!importedLibraries[ module.url ]) {
      importedLibraries[ module.url ] = {
        name: module.name || module.url,
        module: module.scope.export
      };
    } else if (module.fresh) {
      importedLibraries[ module.url ].module = module.scope.export;
    } else {
      module.scope.imports[ module.name ] = importedLibraries[ module.url ].module;
    }

    var currentModule = Galaxy.modules[ module.systemId ];
    if (module.temporary || module.scope._doNotRegister) {
      delete module.scope._doNotRegister;
      currentModule = {
        id: module.id,
        scope: module.scope
      };
    }

    if ('function' === typeof (Galaxy.onModuleLoaded[ module.systemId ])) {
      Galaxy.onModuleLoaded[ module.systemId ](currentModule);
      delete Galaxy.onModuleLoaded[ module.systemId ];
    }

    delete Galaxy.onLoadQueue[ module.systemId ];
  };

  Core.prototype.getModuleAddOnProvider = function (name) {
    return this.addOnProviders.filter(function (service) {
      return service.name === name;
    })[ 0 ];
  };

  Core.prototype.getModulesByAddOnId = function (addOnId) {
    var modules = [];
    var module;

    for (var moduleId in this.modules) {
      module = this.modules[ moduleId ];
      if (this.modules.hasOwnProperty(moduleId) && module.addOns.hasOwnProperty(addOnId)) {
        modules.push({
          addOn: module.addOns[ addOnId ],
          module: module
        });
      }
    }

    return modules;
  };

  Core.prototype.registerAddOnProvider = function (name, handler) {
    if (typeof handler !== 'function') {
      throw 'Addon provider should be a function';
    }

    this.addOnProviders.push({
      name: name,
      handler: handler
    });
  };

}(this));
