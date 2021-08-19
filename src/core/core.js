/* global Galaxy, Promise */
'use strict';
/*!
 * GalaxyJS
 * Eeliya Rasta
 * Released under the MIT License.
 */

/**
 * @exports Galaxy
 */
window.Galaxy = window.Galaxy || /** @class */(function () {
  const AsyncFunction = Object.getPrototypeOf(async function () {
  }).constructor;
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

  const cachedModules = {};
  Core.cm = cachedModules;

  /**
   *
   * @constructor
   */
  function Core() {
    this.moduleContents = {};
    this.addOnProviders = [];
    this.rootElement = null;
  }

  Core.prototype = {
    /**
     *
     * @param {Object} out
     * @returns {*|{}}
     */
    extend: function (out) {
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
    },
    clone: function (obj) {
      let clone = obj instanceof Array ? [] : {};
      clone.__proto__ = obj.__proto__;
      for (let i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (obj[i] instanceof Promise) {
            clone[i] = obj[i];
          } else if (typeof (obj[i]) === 'object' && obj[i] !== null) {
            clone[i] = Galaxy.clone(obj[i]);
          } else {
            clone[i] = obj[i];
          }
        }
      }

      return clone;
    },
    /**
     *
     * @param {Object} bootModule
     * @return {Promise<any>}
     */
    boot: function (bootModule) {
      const _this = this;
      _this.rootElement = bootModule.element;

      bootModule.id = 'system';

      if (!bootModule.element) {
        throw new Error('element property is mandatory');
      }

      return new Promise(function (resolve, reject) {
        _this.load(bootModule).then(function (module) {
          // Replace galaxy temporary bootModule with user specified bootModule
          _this.bootModule = module;
          resolve(module);
        }).catch(function (error) {
          console.error('Something went wrong', error);
          reject();
        });
      });
    },

    convertToURIString: function (obj, prefix) {
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
    },
    /**
     *
     * @param module
     * @return {Promise<any>}
     */
    load: function (module) {
      if (!module) {
        throw new Error('Module meta data or constructor is missing');
      }

      const _this = this;
      return new Promise(function (resolve, reject) {
        if (module.hasOwnProperty('constructor') && typeof module.constructor === 'function') {
          module.path = module.id = 'internal/' + (new Date()).valueOf() + '-' + Math.round(performance.now());
          module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

          return _this.compileModuleContent(module, module.constructor, []).then(function (compiledModule) {
            return _this.executeCompiledModule(compiledModule).then(resolve);
          });
        }

        module.id = module.id || 'noid-' + (new Date()).valueOf() + '-' + Math.round(performance.now());
        module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

        let invokers = [module.path];
        if (module.invokers) {
          if (module.invokers.indexOf(module.path) !== -1) {
            throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwant to load: ' + module.path);
          }

          invokers = module.invokers;
          invokers.push(module.path);
        }

        let url = module.path + '?' + _this.convertToURIString(module.params || {});
        // contentFetcher makes sure that any module gets loaded from network only once unless cache property is present
        let contentFetcher = Galaxy.moduleContents[url];
        if (!contentFetcher || module.fresh) {
          Galaxy.moduleContents[url] = contentFetcher = fetch(url).then((response) => {
            if (!response.ok) {
              console.error(response.statusText, url);
              return reject(response.statusText);
            }

            return response;
          }).catch(reject);
        }

        contentFetcher = contentFetcher.then(response => {
          const contentType = module.contentType || response.headers.get('content-type');
          return response.clone().text().then(content => {
            return new Galaxy.Module.Content(contentType, content, module);
          });
        });

        contentFetcher
          .then(moduleContent => _this.compileModuleContent(module, moduleContent, invokers))
          .then(compiledModule => _this.executeCompiledModule(compiledModule))
          .then(resolve)
          .catch(reject);
      });
    },

    /**
     *
     * @param {Object} moduleMetaData
     * @param moduleConstructor
     * @param invokers
     * @returns {Promise<Galaxy.Module>}
     */
    compileModuleContent: function (moduleMetaData, moduleConstructor, invokers) {
      const _this = this;
      return new Promise(function (resolve, reject) {
        const doneImporting = function (module, imports) {
          imports.splice(imports.indexOf(module.path) - 1, 1);

          if (imports.length === 0) {
            // This will load the original initializer
            resolve(module);
          }
        };

        if (typeof moduleConstructor === 'function') {
          moduleConstructor = new Galaxy.Module.Content('function', moduleConstructor, moduleMetaData);
        }

        const parsedContent = Galaxy.Module.Content.parse(moduleConstructor);
        const imports = parsedContent.imports;
        const source = parsedContent.source;

        const scope = new Galaxy.Scope(moduleMetaData, moduleMetaData.element || _this.rootElement);
        // Create module from moduleMetaData
        const module = new Galaxy.Module(moduleMetaData, source, scope);
        if (imports.length) {
          const importsCopy = imports.slice(0);
          imports.forEach(function (item) {
            const moduleAddOnProvider = Galaxy.getModuleAddOnProvider(item.path);
            // Module is an addon
            if (moduleAddOnProvider) {
              const providerStages = moduleAddOnProvider.handler.call(null, scope, module);
              const addOnInstance = providerStages.create();
              module.registerAddOn(item.path, addOnInstance);
              module.addOnProviders.push(providerStages);

              doneImporting(module, importsCopy);
            }
            // Module is already loaded and we don't need a new instance of it (Singleton)
            else if (cachedModules[item.path] && !item.fresh) {
              doneImporting(module, importsCopy);
            }
            // Module is not loaded
            else {
              if (item.path.indexOf('./') === 0) {
                item.path = scope.uri.path + item.path.substr(2);
              }

              Galaxy.load({
                name: item.name,
                path: item.path,
                fresh: item.fresh,
                contentType: item.contentType,
                parentScope: scope,
                invokers: invokers
              }).then(function () {
                doneImporting(module, importsCopy);
              });
            }
          });

          return;
        }

        resolve(module);
      });
    },

    /**
     *
     * @param {Galaxy.Module}  module
     * @return {Promise<any>}
     */
    executeCompiledModule: function (module) {
      return new Promise(function (resolve, reject) {
        try {
          for (let item in module.addOns) {
            module.scope.inject(item, module.addOns[item]);
          }

          for (let item in cachedModules) {
            if (cachedModules.hasOwnProperty(item)) {
              const asset = cachedModules[item];
              if (asset.module) {
                module.scope.inject(asset.id, asset.module);
              }
            }
          }

          const source = module.source;
          const moduleSource = typeof source === 'function' ?
            source :
            new AsyncFunction('Scope', ['// ' + module.id + ': ' + module.path, source].join('\n'));
          moduleSource.call(null, module.scope).then(() => {
            Reflect.deleteProperty(module, 'source');

            module.addOnProviders.forEach(item => item.start());

            Reflect.deleteProperty(module, 'addOnProviders');

            const id = module.path;
            // if the module export has _temp then do not cache the module
            if (module.scope.export._temp) {
              module.scope.parentScope.inject(id, module.scope.export);
            } else if (!cachedModules[id]) {
              cachedModules[id] = {
                id: id,
                module: module.scope.export
              };
            }

            const currentModule = module;
            currentModule.init();
            return resolve(currentModule);
          });
        } catch (error) {
          console.error(error.message + ': ' + module.path);
          console.warn('Search for es6 features in your code and remove them if your browser does not support them, e.g. arrow function');
          console.error(error);
          reject();
          throw new Error(error);
        }
      });
    },

    getModuleAddOnProvider: function (name) {
      return this.addOnProviders.filter((service) => {
        return service.name === name;
      })[0];
    },

    registerAddOnProvider: function (name, handler) {
      if (typeof handler !== 'function') {
        throw 'Addon provider should be a function';
      }

      this.addOnProviders.push({
        name: name,
        handler: handler
      });
    }
  };

  const instance = new Core();
  instance.Core = Core;

  return instance;
}(this));
