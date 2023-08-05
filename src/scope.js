/* global Galaxy */
(function (_galaxy) {
  'use strict';

  const def_prop = Object.defineProperty;
  const del_prop = Reflect.deleteProperty;

  /**
   *
   * @param {Object} module
   * @param element
   * @constructor
   * @memberOf Galaxy
   */
  function Scope(module, element) {
    const _this = this;
    _this.systemId = module.systemId;
    _this.parentScope = module.parentScope || null;
    _this.element = element || null;
    _this.export = {};

    _this.uri = new _galaxy.GalaxyURI(module.path);
    _this.eventHandlers = {};
    _this.observers = [];
    const _data = _this.element.data ? _galaxy.View.bind_subjects_to_data(_this.element, _this.element.data, _this.parentScope, true) : {};
    def_prop(_this, 'data', {
      enumerable: true,
      configurable: true,
      get: function () {
        return _data;
      },
      set: function (value) {
        if (value === null || typeof value !== 'object') {
          throw Error('The `Scope.data` property must be type of object and can not be null.');
        }

        Object.assign(_data, value);
      }
    });

    /**
     * @property {{
     *   'galaxy/view': _galaxy.View,
     *   'galaxy/router': _galaxy.Router,
     *   [libId]: any
     * }} __imports__
     */

    def_prop(_this, '__imports__', {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    });

    _this.on('module.destroy', this.destroy.bind(_this));
  }

  Scope.prototype = {
    data: null,
    systemId: null,
    parentScope: null,
    /**
     *
     * @param {string} id ID string which is going to be used for importing
     * @param {Object} instance The assigned object to this id
     */
    inject: function (id, instance) {
      this.__imports__[id] = instance;
    },
    /**
     *
     * @param {('galaxy/view' | 'galaxy/router' | string)} libId Path or id of the addon you want to import
     * @return {(_galaxy.View | _galaxy.Router | any)}
     */
    import: function (libId) {
      // if the id starts with `./` then we will replace it with the current scope path.
      if (libId.indexOf('./') === 0) {
        libId = libId.replace('./', this.uri.path);
      }

      return this.__imports__[libId];
    },

    importAsText: function (libId) {
      return this.import(libId + '#text');
    },
    /**
     *
     */
    destroy: function () {
      del_prop(this, 'data');
      this.observers.forEach(function (observer) {
        observer.remove();
      });
    },

    kill: function () {
      throw Error('Scope.kill() should not be invoked at the runtime');
    },
    /**
     *
     * @param {*} moduleMeta
     * @param {*} config
     * @returns {*}
     */
    load: function (moduleMeta, config) {
      const newModuleMetaData = Object.assign({}, moduleMeta, config || {});

      if (newModuleMetaData.path.indexOf('./') === 0) {
        newModuleMetaData.path = this.uri.path + moduleMeta.path.substr(2);
      }

      newModuleMetaData.parentScope = this;
      return _galaxy.load(newModuleMetaData);
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
     * @returns {_galaxy.Observer}
     */
    observe: function (object) {
      const observer = new _galaxy.Observer(object);
      this.observers.push(observer);

      return observer;
    }
  };

  /** @class */
  _galaxy.Scope = Scope;
})(Galaxy);
