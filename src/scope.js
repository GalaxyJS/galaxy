/* global Galaxy */
'use strict';

Galaxy.GalaxyURI = /**@class*/(function () {
  /**
   *
   * @param url
   * @constructor
   */
  function GalaxyURI(url) {
    let urlParser = document.createElement('a');
    urlParser.href = url;
    let myRegexp = /([^\t\n]+)\//g;
    let match = myRegexp.exec(urlParser.pathname);

    this.paresdURL = urlParser.href;
    this.path = match ? match[0] : '/';
  }

  return GalaxyURI;
})();

Galaxy.GalaxyScope = /** @class*/(function () {
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
    this.imports = {};
    this.uri = new Galaxy.GalaxyURI(module.url);
    this.eventHandlers = {};
    this.observers = [];
    this.on('module.destroy', this.destroy.bind(this));
  }

  GalaxyScope.prototype.destroy = function () {
    this.observers.forEach(function (observer) {
      observer.remove();
    });
  };

  GalaxyScope.prototype.load = function (moduleMeta, config) {
    let newModuleMetaData = Object.assign({}, moduleMeta, config || {});
    if (newModuleMetaData.url.indexOf('./') === 0) {
      newModuleMetaData.url = this.path + moduleMeta.url.substr(2);
    }

    newModuleMetaData.parentScope = this;
    newModuleMetaData.domain = newModuleMetaData.domain || Galaxy;
    return Galaxy.load(newModuleMetaData);
  };

  GalaxyScope.prototype.loadModuleInto = function (moduleMetaData, viewNode) {
    return this.load(moduleMetaData, {
      element: viewNode
    }).then(function (module) {
      module.start();
      return module;
    });
  };
  /**
   *
   * @param {string} event
   */
  GalaxyScope.prototype.on = function (event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }

    if (this.eventHandlers[event].indexOf(handler) === -1) {
      this.eventHandlers[event].push(handler);
    }
  };

  GalaxyScope.prototype.trigger = function (event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(function (handler) {
        handler.call(null, data);
      });
    }
  };

  GalaxyScope.prototype.observe = function (object) {
    let observer = new Galaxy.GalaxyObserver(object);

    this.observers.push(observer);

    return observer;
  };

  return GalaxyScope;
})();
