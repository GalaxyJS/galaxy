/* global Galaxy, Promise */

/*!
 * GalaxyJS
 * Eeliya Rasta
 * Released under the MIT License.
 */

/**
 * @exports Galaxy
 */
(function (_window) {
  'use strict';

  /**
   *
   * @typedef {Object} Galaxy.ModuleMetaData
   * @property {Function} [constructor]
   * @property {Function|string} [source]
   * @property {string} [id]
   * @property {string} [systemId]
   * @property {string} [path]
   * @property {Galaxy.Scope} [parentScope]
   * @property {Node} [element]
   */

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

  const Galaxy = {
    moduleContents: {},
    addOnProviders: [],
    rootElement: null,
    bootModule: null,
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
          const v = obj[i];
          // Some objects can not be cloned and must be passed by reference
          if (v instanceof Promise || v instanceof Galaxy.Router) {
            clone[i] = v;
          } else if (typeof (v) === 'object' && v !== null) {
            if (i === 'animations' && v && typeof v === 'object') {
              clone[i] = v;
            } else {
              clone[i] = Galaxy.clone(v);
            }
          } else {
            clone[i] = v;
          }
        }
      }

      return clone;
    },
    /**
     *
     * @param {Galaxy.ModuleMetaData} bootModule
     * @return {Promise<any>}
     */
    boot: function (bootModule) {
      const _this = this;
      _this.rootElement = bootModule.element;

      bootModule.id = '@root';

      if (!_this.rootElement) {
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
     * @param {Galaxy.ModuleMetaData} moduleMetaData
     * @returns {Galaxy.Module}
     */
    createModule: function (moduleMetaData) {
      const scope = new Galaxy.Scope(moduleMetaData, moduleMetaData.element || this.rootElement);
      return new Galaxy.Module(moduleMetaData, scope);
    },

    /**
     *
     * @param {Galaxy.ModuleMetaData} moduleMeta
     * @return {Promise<any>}
     */
    load: function (moduleMeta) {
      if (!moduleMeta) {
        throw new Error('Module meta data or constructor is missing');
      }

      const _this = this;
      return new Promise(function (resolve, reject) {
        if (moduleMeta.hasOwnProperty('constructor') && typeof moduleMeta.constructor === 'function') {
          moduleMeta.path = moduleMeta.id = 'internal/' + (new Date()).valueOf() + '-' + Math.round(performance.now());
          moduleMeta.systemId = moduleMeta.parentScope ? moduleMeta.parentScope.systemId + '/' + moduleMeta.id : moduleMeta.id;
          moduleMeta.source = moduleMeta.constructor;

          return _this.executeCompiledModule(_this.createModule(moduleMeta)).then(resolve);
        }

        moduleMeta.path = moduleMeta.path.indexOf('/') === 0 ? moduleMeta.path.substring(1) : moduleMeta.path;
        if (!moduleMeta.id) {
          moduleMeta.id = '@' + moduleMeta.path;
        }
        moduleMeta.systemId = moduleMeta.parentScope ? moduleMeta.parentScope.systemId + '/' + moduleMeta.id : moduleMeta.id;

        let url = moduleMeta.path /*+ '?' + _this.convertToURIString(module.params || {})*/;
        // contentFetcher makes sure that any module gets loaded from network only once
        let contentFetcher = Galaxy.moduleContents[url];
        if (!contentFetcher) {
          Galaxy.moduleContents[url] = contentFetcher = fetch(url).then((response) => {
            if (!response.ok) {
              console.error(response.statusText, url);
              return reject(response.statusText);
            }

            return response;
          }).catch(reject);
        }

        contentFetcher = contentFetcher.then(response => {
          return response.clone().text();
        });

        contentFetcher.then(text => {
          return _this.executeCompiledModule(_this.createModule(moduleMeta));
        }).then(resolve).catch(reject);
      });
    },

    /**
     *
     * @param {Galaxy.Module}  module
     * @return {Promise<any>}
     */
    executeCompiledModule: function (module) {
      return new Promise(async function (resolve, reject) {
        try {
          const source = module.source || (await import('/' + module.path)).default;

          let moduleSource = source;
          if (typeof source !== 'function') {
            moduleSource = function () {
              console.error('Can\'t find default function in %c' + module.path, 'font-weight: bold;');
            };
          }

          const output = moduleSource.call(null, module.scope) || null;
          const proceed = () => {
            module.init();
            return resolve(module);
          };

          // if the function is not async, output would be undefined
          if (output) {
            output.then(proceed);
          } else {
            proceed();
          }
        } catch (error) {
          console.error(error.message + ': ' + module.path);
          // console.warn('Search for es6 features in your code and remove them if your browser does not support them, e.g. arrow function');
          console.trace(error);
          reject();
        }
      });
    },
  };

  _window.Galaxy = _window.Galaxy || Galaxy;
}(this));
