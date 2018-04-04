/* global Galaxy, Promise */
'use strict';
/**
 * @exports Galaxy
 */
(function (root) {
  Array.prototype.unique = function () {
    const a = this.concat();
    for (let i = 0, lenI = a.length; i < lenI; ++i) {
      for (let j = i + 1, lenJ = a.length; j < lenJ; ++j) {
        if (a[i] === a[j]) {
          a.splice(j--, 1);
        }
      }
    }

    return a;
  };

  root.Reflect = root.Reflect || {
    deleteProperty: function (target, propertyKey) {
      delete target[propertyKey];
    }
  };

  /**
   *
   * @namespace
   */
  const Galaxy = root.Galaxy || new GalaxyCore();
  root.Galaxy = Galaxy;
  /** The main class of the GalaxyJS. window.Galaxy is an instance of this class.
   *
   * @type {GalaxyCore}
   */
  Galaxy.GalaxyCore = GalaxyCore;

  /**
   * @type Function
   */
  Galaxy.defineProp = Object.defineProperty;

  Galaxy.clone = function (obj) {
    let clone = obj instanceof Array ? [] : {};
    clone.__proto__ = obj.__proto__;
    for (let i in obj) {
      if (obj.hasOwnProperty(i)) {
        if (typeof(obj[i]) === 'object' && obj[i] !== null) {

          clone[i] = Galaxy.clone(obj[i]);
        } else {
          // console.info(Object.getOwnPropertyDescriptor(obj, i).enumerable, i);
          clone[i] = obj[i];
        }
      }
    }

    return clone;
  };

  const importedLibraries = {};

  /**
   *
   * @constructor
   */
  function GalaxyCore() {
    this.bootModule = null;
    this.modules = {};
    this.moduleContents = {};
    this.addOnProviders = [];
    this.app = null;
    this.rootElement = null;
  }

  /**
   *
   * @param {Object} out
   * @returns {*|{}}
   */
  GalaxyCore.prototype.extend = function (out) {
    let result = out || {}, obj;
    for (let i = 1; i < arguments.length; i++) {
      obj = arguments[i];

      if (!obj) {
        continue;
      }

      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (obj[key] instanceof Array) {
            result[key] = this.extend(result[key] || [], obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            result[key] = this.extend(result[key] || {}, obj[key]);
          } else {
            result[key] = obj[key];
          }
        }
      }
    }

    return result;
  };

  /**
   *
   * @param {Object} bootModule
   * @return {Promise<any>}
   */
  GalaxyCore.prototype.boot = function (bootModule) {
    const _this = this;
    _this.rootElement = bootModule.element;

    bootModule.domain = this;
    bootModule.id = 'system';

    if (!bootModule.element) {
      throw new Error('element property is mandatory');
    }

    const promise = new Promise(function (resolve, reject) {
      _this.load(bootModule).then(function (module) {
        // Replace galaxy temporary  bootModule with user specified bootModule
        _this.bootModule = module;
        resolve(module);
      }).catch(function (error) {
        console.error('Something went wrong', error);
        reject();
      });
    });

    return promise;
  };

  GalaxyCore.prototype.convertToURIString = function (obj, prefix) {
    let _this = this;
    let str = [], p;
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        let k = prefix ? prefix + '[' + p + ']' : p, v = obj[p];
        str.push((v !== null && typeof v === 'object') ? _this.convertToURIString(v, k) : encodeURIComponent(k) + '=' +
          encodeURIComponent(v));
      }
    }

    return str.join('&');
  };

  /**
   *
   * @param module
   * @return {Promise<any>}
   */
  GalaxyCore.prototype.load = function (module) {
    const _this = this;

    if (!module) {
      throw new Error('Module meta data or constructor is missing');
    }

    const promise = new Promise(function (resolve, reject) {
      if (module.hasOwnProperty('constructor') && typeof module.constructor === 'function') {
        module.url = module.id = 'internal/' + (new Date()).valueOf() + '-' + Math.round(performance.now());
        module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

        return _this.compileModuleContent(module, module.constructor, []).then(function (compiledModule) {
          return _this.executeCompiledModule(compiledModule).then(resolve);
        });
      }

      module.id = module.id || 'noid-' + (new Date()).valueOf() + '-' + Math.round(performance.now());
      module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

      // root.Galaxy.onModuleLoaded[module.systemId] = resolve;
      // var moduleExist = Galaxy.modules[module.systemId];

      let invokers = [module.url];
      if (module.invokers) {
        if (module.invokers.indexOf(module.url) !== -1) {
          throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
        }

        invokers = module.invokers;
        invokers.push(module.url);
      }

      // Galaxy.onLoadQueue[module.systemId] = true;
      let url = module.url + '?' + _this.convertToURIString(module.params || {});
      // var fetcher = root.Galaxy.onModuleLoaded[url];

      // fetcherContent makes sure that any module gets loaded from network only once unless fresh property is present
      let fetcherContent = Galaxy.moduleContents[url];

      if (!fetcherContent || module.fresh) {
        Galaxy.moduleContents[url] = fetcherContent = fetch(url).then(function (response) {
          if (response.status !== 200) {
            reject(response);
            return '';
          }

          return response.text();
        }).catch(reject);
      }

      fetcherContent.then(function (moduleContent) {
        _this.compileModuleContent(module, moduleContent, invokers).then(function (compiledModule) {
          return _this.executeCompiledModule(compiledModule).then(resolve);
        });

        return moduleContent;
      }).catch(reject);
    });

    return promise;
  };

  /**
   *
   * @param {Object} moduleMetaData
   * @param moduleConstructor
   * @param invokers
   * @returns {Promise<Galaxy.GalaxyModule>}
   */
  GalaxyCore.prototype.compileModuleContent = function (moduleMetaData, moduleConstructor, invokers) {
    const _this = this;
    const promise = new Promise(function (resolve, reject) {
      let doneImporting = function (module, imports) {
        imports.splice(imports.indexOf(module.importId || module.url) - 1, 1);

        if (imports.length === 0) {
          // This will load the original initializer
          resolve(module);
        }
      };

      const unique = [];
      let imports = [];

      if (typeof moduleConstructor === 'function') {
        imports = moduleMetaData.imports ? moduleMetaData.imports.slice(0) : [];
        imports = imports.map(function (item) {
          if (unique.indexOf(item) !== -1) {
            return null;
          }

          unique.push(item);
          return { url: item };
        }).filter(Boolean);
      } else {
        // extract imports from the source code
        // removing comments cause an bug

        moduleConstructor = moduleConstructor.replace(/\/\*[\s\S]*?\*\n?\/|([^:;]|^)^[^\n]?\s*\/\/.*\n?$/gm, '');
        moduleConstructor = moduleConstructor.replace(/Scope\.import\(['|"](.*)['|"]\);/gm, function (match, path) {
          let query = path.match(/([\S]+)/gm);
          let url = query[query.length - 1];
          if (unique.indexOf(url) !== -1) {
            return 'Scope.__imports__[\'' + url + '\']';
          }

          unique.push(url);
          imports.push({
            url: url,
            fresh: query.indexOf('new') !== -1
          });

          return 'Scope.__imports__[\'' + url + '\']';
        });
      }

      const scope = new Galaxy.GalaxyScope(moduleMetaData, moduleMetaData.element || _this.rootElement);
      // Create module from moduleMetaData
      const module = new Galaxy.GalaxyModule(moduleMetaData, moduleConstructor, scope);
      Galaxy.modules[module.systemId] = module;

      if (imports.length) {
        const importsCopy = imports.slice(0);
        imports.forEach(function (item) {
          let moduleAddOnProvider = Galaxy.getModuleAddOnProvider(item.url);
          if (moduleAddOnProvider) {
            let providerStages = moduleAddOnProvider.handler.call(null, scope, module);
            let addOnInstance = providerStages.create();
            module.registerAddOn(item.url, addOnInstance);
            module.addOnProviders.push(providerStages);

            doneImporting(module, importsCopy);
          } else if (importedLibraries[item.url] && !item.fresh) {
            doneImporting(module, importsCopy);
          } else {
            const importId = item.url;
            if (item.url.indexOf('./') === 0) {
              item.url = scope.uri.path + item.url.substr(2);
            }

            Galaxy.load({
              importId: importId,
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

        return;
      }

      resolve(module);
    });

    return promise;
  };

  /**
   *
   * @param {Galaxy.GalaxyModule}  module
   * @return {Promise<any>}
   */
  GalaxyCore.prototype.executeCompiledModule = function (module) {
    const promise = new Promise(function (resolve, reject) {
      for (let item in module.addOns) {
        module.scope.inject(item, module.addOns[item]);
      }

      for (let item in importedLibraries) {
        if (importedLibraries.hasOwnProperty(item)) {
          let asset = importedLibraries[item];
          if (asset.module) {
            module.scope.inject(asset.name, asset.module);
          }
        }
      }

      const source = ['// ' + module.url, module.source];
      const moduleSource = typeof module.source === 'function' ? module.source : new Function('Scope', source.join('\n'));
      moduleSource.call(null, module.scope);

      Reflect.deleteProperty(module, 'source');

      module.addOnProviders.forEach(function (item) {
        item.finalize();
      });

      Reflect.deleteProperty(module, 'addOnProviders');

      const mId = module.importId || module.url;
      if (!importedLibraries[mId]) {
        importedLibraries[mId] = {
          name: module.name || mId,
          module: module.scope.exports
        };
      } else if (module.fresh) {
        importedLibraries[mId].module = module.scope.exports;
      } else {
        // module.scope.imports[module.url] = importedLibraries[module.url].module;
      }

      let currentModule = Galaxy.modules[module.systemId];
      if (module.temporary || module.scope._doNotRegister) {
        Reflect.deleteProperty(module, 'scope._doNotRegister');
        currentModule = {
          id: module.id,
          scope: module.scope
        };
      }

      currentModule.init();

      resolve(currentModule);
    });

    return promise;
  };

  GalaxyCore.prototype.getModuleAddOnProvider = function (name) {
    return this.addOnProviders.filter(function (service) {
      return service.name === name;
    })[0];
  };

  GalaxyCore.prototype.registerAddOnProvider = function (name, handler) {
    if (typeof handler !== 'function') {
      throw 'Addon provider should be a function';
    }

    this.addOnProviders.push({
      name: name,
      handler: handler
    });
  };

}(this));
