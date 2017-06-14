/* global Galaxy, Promise */

(function (root) {
  Array.prototype.unique = function () {
    var a = this.concat();
    for (var i = 0; i < a.length; ++i) {
      for (var j = i + 1; j < a.length; ++j) {
        if (a[i] === a[j])
          a.splice(j--, 1);
      }
    }

    return a;
  };

  root.Galaxy = root.Galaxy || new Core();

  /** The main class of the GalaxyJS. window.galaxy is an instance of this class.
   *
   * @returns {Galaxy.GalaxySystem}
   */
  Galaxy.GalaxyCore = Core;

  var importedLibraries = {};

  function Core() {
    this.bootModule = null;
    this.modules = {};
    this.onLoadQueue = [];
    this.moduleContents = {};
    this.addOnProviders = [];
    this.app = null;
    this.rootElement = null;
  }

  Core.prototype.extend = function (out) {
    var result = out || {}, obj;
    for (var i = 1; i < arguments.length; i++) {
      obj = arguments[i];

      if (!obj)
        continue;

      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (obj[key] instanceof Array)
            result[key] = this.extend(result[key] || [], obj[key]);
          else if (typeof obj[key] === 'object' && obj[key] !== null)
            result[key] = this.extend(result[key] || {}, obj[key]);
          else
            result[key] = obj[key];
        }
      }
    }

    return result;
  };

  Core.prototype.resetObjectTo = function (out, value) {
    if (value !== null && typeof value !== 'object') {
      return value;
    }

    if (value === null) {
      for (var k in out) {
        if (typeof out[k] === 'object') {
          out[k] = this.resetObjectTo(out[k], null);
        }
        else {
          out[k] = null;
        }
      }

      return out;
    }

    var outKeys = Object.keys(out);
    var keys = outKeys.concat(Object.keys(value)).unique();
    for (var i = 0, len = keys.length; i < len; i++) {
      var key = keys[i];
      if (value.hasOwnProperty(key)) {
        out[key] = this.resetObjectTo(out[key], value[key]);
      }
      else if (typeof out[key] === 'object') {
        this.resetObjectTo(out[key], null);
      }
      else {
        out[key] = null;
      }
    }

    return out;
  };

  /**
   *
   * @param bootModule
   * @param {Element} rootElement
   */
  Core.prototype.boot = function (bootModule) {
    var _this = this;
    _this.rootElement = bootModule.element;

    bootModule.domain = this;
    bootModule.id = 'system';

    if (!bootModule.element) {
      throw new Error('element property is mandatory');
    }

    var promise = new Promise(function (resolve, reject) {
      _this.load(bootModule).then(function (module) {
        // Replace galaxy temporary  bootModule with user specified bootModule
        _this.bootModule = module;
        resolve(module);
      });
    });

    return promise;
  };

  Core.prototype.convertToURIString = function (obj, prefix) {
    var _this = this;
    var str = [], p;
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        var k = prefix ? prefix + '[' + p + ']' : p, v = obj[p];
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

      // root.Galaxy.onModuleLoaded[module.systemId] = resolve;
      // var moduleExist = Galaxy.modules[module.systemId];

      var invokers = [module.url];
      if (module.invokers) {
        if (module.invokers.indexOf(module.url) !== -1) {
          throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
        }

        invokers = module.invokers;
        invokers.push(module.url);
      }

      // if (moduleExist) {
      //   _this.compileModuleContent(module, moduleExist, invokers).then(function (module) {
      //
      //     _this.executeCompiledModule(module).then(resolve);
      //   });
      //   // resolve(moduleExist);
      //   // var ol = Galaxy.onModuleLoaded[module.systemId];
      //
      //   // if ('function' === typeof (ol)) {
      //   //   ol(moduleExist);
      //   //   delete Galaxy.onModuleLoaded[module.systemId];
      //   // }
      //
      //   return;
      // }

      // if (Galaxy.onLoadQueue[module.systemId]) {
      //   return;
      // }

      Galaxy.onLoadQueue[module.systemId] = true;
      var url = module.url + '?' + _this.convertToURIString(module.params || {});
      // var fetcher = root.Galaxy.onModuleLoaded[url];
      var fetcherContent = root.Galaxy.moduleContents[url];

      if (!fetcherContent || module.fresh) {
        // root.Galaxy.moduleContents[url] = fetcherContent = fetch(url).then(function (response) {
        //   return response.text();
        // }).then(function (moduleContent) {
        //   return _this.compileModuleContent(module, moduleContent, invokers).then(function (module) {
        //     return _this.executeCompiledModule(module);
        //   });
        // });

        root.Galaxy.moduleContents[url] = fetcherContent = fetch(url).then(function (response) {
          return response.text();
        });
      }

      // fetcherContent.then(resolve);
      fetcherContent.then(function (moduleContent) {
        _this.moduleContents[module.systemId] = moduleContent;
        _this.compileModuleContent(module, moduleContent, invokers).then(function (module) {
          return _this.executeCompiledModule(module).then(resolve);
        });

        return moduleContent;
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
      var moduleContentWithoutComments = moduleContent.replace(/\/\*[\s\S]*?\*\n?\/|([^:;]|^)\n?\/\/.*\n?$/gm, '');
      moduleContent = moduleContentWithoutComments.replace(/Scope\.import\(['|"](.*)['|"]\)\;/gm, function (match, path) {
        var query = path.match(/([\S]+)/gm);
        imports.push({
          url: query[query.length - 1],
          fresh: query.indexOf('new') !== -1
        });

        return 'Scope.imports[\'' + query[query.length - 1] + '\']';
      });

      var scope = new Galaxy.GalaxyScope(moduleMetaData, moduleMetaData.element || _this.rootElement);
      // var view = new Galaxy.GalaxyView(scope);
      // Create module from moduleMetaData
      var module = new Galaxy.GalaxyModule(moduleMetaData, moduleContent, scope);
      Galaxy.modules[module.systemId] = module;

      if (imports.length) {
        var importsCopy = imports.slice(0);
        imports.forEach(function (item) {
          var moduleAddOnProvider = Galaxy.getModuleAddOnProvider(item.url);
          if (moduleAddOnProvider) {
            var providerStages = moduleAddOnProvider.handler.call(null, scope, module);
            var addOnInstance = providerStages.create();
            importedLibraries[item.url] = {
              name: item.url,
              module: addOnInstance
            };

            module.registerAddOn(item.url, addOnInstance);
            module.addOnProviders.push(providerStages);

            doneImporting(module, importsCopy);
          } else if (importedLibraries[item.url] && !item.fresh) {
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
    var promise = new Promise(function (resolve, reject) {
      for (var item in importedLibraries) {
        if (importedLibraries.hasOwnProperty(item)) {
          var asset = importedLibraries[item];
          if (asset.module) {
            module.scope.imports[asset.name] = asset.module;
          }
        }
      }

      var moduleSource = new Function('Scope', module.source);
      moduleSource.call(null, module.scope);

      delete module.source;

      module.addOnProviders.forEach(function (item) {
        item.finalize();
      });

      delete module.addOnProviders;

      if (!importedLibraries[module.url]) {
        importedLibraries[module.url] = {
          name: module.name || module.url,
          module: module.scope.export
        };
      } else if (module.fresh) {
        importedLibraries[module.url].module = module.scope.export;
      } else {
        module.scope.imports[module.name] = importedLibraries[module.url].module;
      }

      var currentModule = Galaxy.modules[module.systemId];
      if (module.temporary || module.scope._doNotRegister) {
        delete module.scope._doNotRegister;
        currentModule = {
          id: module.id,
          scope: module.scope
        };
      }

      resolve(currentModule);

      delete Galaxy.onLoadQueue[module.systemId];
    });

    return promise;
  };

  Core.prototype.getModuleAddOnProvider = function (name) {
    return this.addOnProviders.filter(function (service) {
      return service.name === name;
    })[0];
  };

  Core.prototype.getModulesByAddOnId = function (addOnId) {
    var modules = [];
    var module;

    for (var moduleId in this.modules) {
      module = this.modules[moduleId];
      if (this.modules.hasOwnProperty(moduleId) && module.addOns.hasOwnProperty(addOnId)) {
        modules.push({
          addOn: module.addOns[addOnId],
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
