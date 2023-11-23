import Scope from './scope.js';
import Module from './module.js';
import View from './view.js';

export function convertToURIString(obj, prefix) {
  let str = [], p;
  for (p in obj) {
    if (obj.hasOwnProperty(p)) {
      let k = prefix ? prefix + '[' + p + ']' : p, v = obj[p];
      str.push((v !== null && typeof v === 'object') ? convertToURIString(v, k) : encodeURIComponent(k) + '=' +
        encodeURIComponent(v));
    }
  }

  return str.join('&');
}

/**
 *
 * @param {Galaxy} galaxy
 * @param {Galaxy.ModuleMetaData} moduleMetaData
 * @returns {Galaxy.Module}
 */
export function createModule(galaxy, moduleMetaData) {
  const scope = new Scope(galaxy, moduleMetaData, moduleMetaData.element || this.rootElement);
  return new Module(moduleMetaData, scope);
}

/**
 *
 * @param {Galaxy.Module}  module
 * @return {Promise<any>}
 */
export function executeCompiledModule(module) {
  return new Promise(async function (resolve, reject) {
    try {
      const source = module.source || (await import(/* @vite-ignore */'/' + module.path)).default;

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
}


/**
 *
 * @memberOf Galaxy.Scope
 * @returns {Galaxy.View}
 */
Scope.prototype.useView = function () {
  return new View(this);
};


