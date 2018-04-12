/* global Galaxy */
'use strict';

Galaxy.GalaxyScope = /** @class */ (function () {
  const defProp = Object.defineProperty;

  /**
   *
   * @param {Object} module
   * @param element
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxyScope(module, element) {
    this.systemId = module.systemId;
    this.parentScope = module.parentScope || null;
    this.element = element || null;
    this.exports = {};
    this.uri = new Galaxy.GalaxyURI(module.url);
    this.eventHandlers = {};
    this.observers = [];
    this.data = {};

    defProp(this, '__imports__', {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    });

    this.on('module.destroy', this.destroy.bind(this));
  }

  GalaxyScope.prototype = {
    /**
     *
     * @param id ID string which is going to be used for importing
     * @param instance The assigned object to this id
     */
    inject: function (id, instance) {
      this['__imports__'][id] = instance;
    },
    /**
     *
     * @param libId Path or id of the addon you want to import
     * @return {*}
     */
    import: function (libId) {
      return this['__imports__'][libId];
    },
    /**
     *
     */
    destroy: function () {
      this.observers.forEach(function (observer) {
        observer.remove();
      });
    },
    /**
     *
     * @param moduleMeta
     * @param config
     * @returns {*}
     */
    load: function (moduleMeta, config) {
      let newModuleMetaData = Object.assign({}, moduleMeta, config || {});

      if (newModuleMetaData.url.indexOf('./') === 0) {
        newModuleMetaData.url = this.uri.path + moduleMeta.url.substr(2);
      }

      newModuleMetaData.parentScope = this;
      newModuleMetaData.domain = newModuleMetaData.domain || Galaxy;
      return Galaxy.load(newModuleMetaData);
    },
    /**
     *
     * @param moduleMetaData
     * @param viewNode
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    loadModuleInto: function (moduleMetaData, viewNode) {
      return this.load(moduleMetaData, {
        element: viewNode
      }).then(function (module) {
        module.start();
        return module;
      });
    },
    /**
     *
     * @param {string} event
     * @param {Function} handler
     */
    on: function (event, handler) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }

      if (this.eventHandlers[event].indexOf(handler) === -1) {
        this.eventHandlers[event].push(handler);
      }
    },
    /**
     *
     * @param {string} event
     * @param {*} data
     */
    trigger: function (event, data) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach(function (handler) {
          handler.call(null, data);
        });
      }
    },
    /**
     *
     * @param object
     * @returns {Galaxy.Observer}
     */
    observe: function (object) {
      const observer = new Galaxy.Observer(object);
      this.observers.push(observer);

      return observer;
    }
  };

  return GalaxyScope;
})();
