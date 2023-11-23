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

import { createModule, executeCompiledModule } from './src/core.js';

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

/**
 * @namespace Galaxy
 */
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

        return executeCompiledModule(createModule(_this, moduleMeta)).then(resolve);
      }

      moduleMeta.path = moduleMeta.path.indexOf('/') === 0 ? moduleMeta.path.substring(1) : moduleMeta.path;
      if (!moduleMeta.id) {
        moduleMeta.id = '@' + moduleMeta.path;
      }
      moduleMeta.systemId = moduleMeta.parentScope ? moduleMeta.parentScope.systemId + '/' + moduleMeta.id : moduleMeta.id;

      let url = moduleMeta.path /*+ '?' + _this.convertToURIString(module.params || {})*/;
      // contentFetcher makes sure that any module gets loaded from network only once
      let contentFetcher = _this.moduleContents[url];
      if (!contentFetcher) {
        _this.moduleContents[url] = contentFetcher = fetch(url).then((response) => {
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
        return executeCompiledModule(createModule(_this, moduleMeta));
      }).then(resolve).catch(reject);
    });
  },
};

export default Galaxy;
