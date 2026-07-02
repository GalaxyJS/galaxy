import { def_prop, del_prop } from "./utils";
import GalaxyURI from "./uri.js";
import Observer from "./observer.js";
import { bind_subjects_to_data } from "./view.js";
import Module from "./module.js";
import { prepare_module_meta_data } from "./runtime.js";

/**
 * @class Scope
 * @memberOf GalaxyJS
 */
export default class Scope {
  moduleId = null;
  path = null;
  source = null;

  /**
   *
   * @param {ModuleMetaData} moduleMetaData
   */
  constructor(moduleMetaData) {
    this.moduleId = moduleMetaData.id;
    this.parentScope = moduleMetaData.parentScope || null;
    this.source = typeof moduleMetaData.source === "function" ? moduleMetaData.source : null;
    this.path = moduleMetaData.path || null;
    this.element = moduleMetaData.element || null;
    this.export = {};
    this.uri = new GalaxyURI(moduleMetaData.path);
    this.eventHandlers = {};
    this.observers = [];

    const _data = this.element.data
      ? bind_subjects_to_data(
        this.element,
        this.element.data,
        this.parentScope,
        true,
      )
      : {};
    def_prop(this, "data", {
      enumerable: true,
      configurable: true,
      get: function() {
        return _data;
      },
      set: function(value) {
        if (value === null || typeof value !== "object") {
          throw Error(
            "The `Scope.data` property must be type of object and can not be null.",
          );
        }

        Object.assign(_data, value);
      },
    });

    this.on("module.destroy", this.destroy.bind(this));
  }

  importAsText(libId) {
    if (libId.indexOf("./") === 0) {
      libId = libId.replace("./", this.uri.path);
    }

    return fetch(libId, {
      headers: {
        "Content-Type": "text/plain",
      },
    }).then((response) => {
      return response.text();
    });
  }

  destroy() {
    del_prop(this, "data");
    this.observers.forEach(function(observer) {
      observer.remove();
    });
  }

  kill() {
    throw Error("Scope.kill() should not be invoked at the runtime");
  }

  load(moduleMeta, config = {}) {
    const newModuleMetaData = Object.assign({}, moduleMeta, config);

    if (newModuleMetaData.path.indexOf("./") === 0) {
      newModuleMetaData.path = this.uri.path + moduleMeta.path.substr(2);
    }

    newModuleMetaData.parentScope = this;
    return prepare_module_meta_data(newModuleMetaData).then(preparedModuleMetaData => {
      const scope = new Scope(preparedModuleMetaData);

      return new Module(scope).init();
    });
  }

  loadModuleInto(moduleMetaData, viewNode) {
    return this.load(moduleMetaData, {
      element: viewNode,
    }).then(function(module) {
      module.start();
      return module;
    });
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }

    if (this.eventHandlers[event].indexOf(handler) === -1) {
      this.eventHandlers[event].push(handler);
    }
  }

  trigger(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(function(handler) {
        handler.call(null, data);
      });
    }
  }

  observe(object) {
    const observer = new Observer(object);
    this.observers.push(observer);

    return observer;
  }
}

