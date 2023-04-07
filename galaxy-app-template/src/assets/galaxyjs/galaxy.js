/* global Galaxy, Promise */

/*!
 * GalaxyJS
 * Eeliya Rasta
 * Released under the MIT License.
 */

/**
 * @exports Galaxy
 */
window.Galaxy = window.Galaxy || /** @class */(function () {
  'use strict';

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

  const CACHED_MODULES = {};

  Core.cm = CACHED_MODULES;

  /**
   *
   * @constructor
   */
  function Core() {
    this.moduleContents = {};
    this.addOnProviders = [];
    this.rootElement = null;
    this.bootModule = null;
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
     * @param {Object} bootModule
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

        module.path = module.path.indexOf('/') === 0 ? module.path.substring(1) : module.path;
        // module.path = module.path.indexOf('/') === 0 ? module.path : '/' + module.path;
        if (!module.id) {
          module.id = '@' + module.path;
        }
        module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

        let invokers = [module.path];
        if (module.invokers) {
          const invokedPath = module.invokerPath + '|' + module.path;
          if (module.invokers.indexOf(invokedPath) !== -1) {
            return reject(new Error('Circular dependencies: \n-> ' + module.invokerPath + ' wants to load ' + module.path));
          }

          invokers = module.invokers;
          invokers.push(invokedPath);
        }

        let url = module.path /*+ '?' + _this.convertToURIString(module.params || {})*/;
        // if (module.params) debugger
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

        const scope = new Galaxy.Scope(moduleMetaData, moduleMetaData.element || _this.rootElement);
        // Create module from moduleMetaData
        const module = new Galaxy.Module(moduleMetaData, scope, parsedContent.source, parsedContent.native);
        if (imports.length) {
          const importsCopy = imports.slice(0);
          imports.forEach(function (importable) {
            const moduleAddOnProvider = Galaxy.getAddOnProvider(importable.path);
            // importable is an addon
            if (moduleAddOnProvider) {
              module.addAddOn(moduleAddOnProvider);
              doneImporting(module, importsCopy);
            }
            // importable is already loaded, and we don't need a new instance of it (Singleton)
            else if (CACHED_MODULES[importable.path] && !importable.fresh) {
              doneImporting(module, importsCopy);
            }
            // importable is not loaded
            else {
              if (importable.path.indexOf('./') === 0) {
                importable.path = scope.uri.path + importable.path.substring(2);
              }

              Galaxy.load({
                name: importable.name,
                path: importable.path,
                fresh: importable.fresh,
                contentType: importable.contentType,
                // params: item.params,
                parentScope: scope,
                invokers: invokers,
                invokerPath: module.path
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
      return new Promise(async function (resolve, reject) {
        try {
          for (let item in module.addOns) {
            module.scope.inject(item, module.addOns[item]);
          }

          for (let item in CACHED_MODULES) {
            if (CACHED_MODULES.hasOwnProperty(item)) {
              const asset = CACHED_MODULES[item];
              if (asset.module) {
                module.scope.inject(asset.id, asset.module);
              }
            }
          }

          const source = module.native ? (await import('/' + module.path)).default : module.source;

          let moduleSource = source;
          if (typeof source !== 'function') {
            moduleSource = function () {
              console.error('Can\'t find default function in %c' + module.path, 'font-weight: bold;');
            };
            // moduleSource = new AsyncFunction('Scope', ['//' + module.id + ': ' + module.path, '"use strict";\n', source].join('\n'));
          }

          const output = moduleSource.call(null, module.scope) || null;

          const proceed = () => {
            const id = module.path;
            // if the module export has _temp then do not cache the module
            if (module.scope.export._temp) {
              module.scope.parentScope.inject(id, module.scope.export);
            } else if (!CACHED_MODULES[id]) {
              CACHED_MODULES[id] = {
                id: id,
                module: module.scope.export
              };
            }

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
          // throw new Error(error);
        }
      });
    },

    getAddOnProvider: function (name) {
      return this.addOnProviders.filter((service) => {
        return service.name === name;
      })[0];
    },

    registerAddOnProvider: function (name, handler) {
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

/* global Galaxy */
Galaxy.Module = /** @class */ (function () {

  /**
   *
   * @param {object} module
   * @param {Galaxy.Scope} scope
   * @param {string} source
   * @param {boolean} native
   * @constructor
   * @memberOf Galaxy
   */
  function Module(module, scope, source, native) {
    this.id = module.id;
    this.systemId = module.systemId;
    this.source = source;
    this.path = module.path || null;
    this.importId = module.importId || module.path;
    this.addOns = module.addOns || {};
    this.addOnProviders = {};
    this.scope = scope;
    this.native = native || false;
  }

  Module.prototype = {
    init: function () {
      const providers = this.addOnProviders;
      Reflect.deleteProperty(this, 'source');
      Reflect.deleteProperty(this, 'addOnProviders');

      for (let addOnName in this.addOns) {
        providers[addOnName].startInstance(this.addOns[addOnName], this);
      }

      this.scope.trigger('module.init');
    },

    start: function () {
      this.scope.trigger('module.start');
    },

    destroy: function () {
      this.scope.trigger('module.destroy');
    },

    addAddOn: function (addOnProvider) {
      const h = addOnProvider.handler;
      this.addOnProviders[addOnProvider.name] = h;
      this.addOns[addOnProvider.name] = h.provideInstance(this.scope, this);
    }
  };

  return Module;
})();

Galaxy.Module.Content = /** @class */ (function () {
  const parsers = {};

  /**
   *
   * @param {Galaxy.Module.Content} ModuleContent
   * @returns {*}
   */
  Content.parse = function (ModuleContent) {
    const safeType = (ModuleContent.type || '').split(';')[0];
    const parser = parsers[safeType];

    if (parser) {
      return parser.call(null, ModuleContent.content, ModuleContent.metaData);
    }

    return parsers['default'].call(null, ModuleContent.content, ModuleContent.metaData);
  };

  /**
   *
   * @param {string} type
   * @param {function} parser
   */
  Content.registerParser = function (type, parser) {
    parsers[type] = parser;
  };

  /**
   *
   * @param {string} type
   * @param {*} content
   * @param {*} metaData
   * @constructor
   * @memberOf Galaxy.Module
   */
  function Content(type, content, metaData) {
    this.type = type;
    this.content = content;
    this.metaData = metaData;
  }

  Content.prototype = {};

  return Content;
})();

/* global Galaxy */
Galaxy.Observer = /** @class */ (function () {
  const defProp = Object.defineProperty;

  Observer.notify = function (obj, key, value) {
    const observers = obj.__observers__;

    if (observers !== undefined) {
      observers.forEach(function (observer) {
        observer.notify(key, value);
      });
    }
  };

  /**
   *
   * @param {Object} context
   * @constructor
   * @memberOf Galaxy
   */
  function Observer(context) {
    this.context = context;
    this.subjectsActions = {};
    this.allSubjectAction = [];

    const __observers__ = '__observers__';
    if (!this.context.hasOwnProperty(__observers__)) {
      defProp(context, __observers__, {
        value: [],
        writable: true,
        configurable: true
      });
    }

    this.context[__observers__].push(this);
  }

  Observer.prototype = {
    remove: function () {
      const observers = this.context.__observers__;
      const index = observers.indexOf(this);
      if (index !== -1) {
        observers.splice(index, 1);
      }
    },
    /**
     *
     * @param {string} key
     * @param value
     */
    notify: function (key, value) {
      const _this = this;

      if (_this.subjectsActions.hasOwnProperty(key)) {
        _this.subjectsActions[key].call(_this.context, value);
      }

      _this.allSubjectAction.forEach(function (action) {
        action.call(_this.context, key, value);
      });
    },
    /**
     *
     * @param subject
     * @param action
     */
    on: function (subject, action) {
      this.subjectsActions[subject] = action;
    },
    /**
     *
     * @param {Function} action
     */
    onAll: function (action) {
      if (this.allSubjectAction.indexOf(action) === -1) {
        this.allSubjectAction.push(action);
      }
    }
  };

  return Observer;
})();

/* global Galaxy */
Galaxy.Scope = /** @class */ (function () {
  const defProp = Object.defineProperty;
  const delProp = Reflect.deleteProperty;

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

    _this.uri = new Galaxy.GalaxyURI(module.path);
    _this.eventHandlers = {};
    _this.observers = [];
    const _data = _this.element.data ? Galaxy.View.bind_subjects_to_data(_this.element, _this.element.data, _this.parentScope, true) : {};
    defProp(_this, 'data', {
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
     *   'galaxy/view': Galaxy.View,
     *   'galaxy/router': Galaxy.Router,
     *   [libId]: any
     * }} __imports__
     */

    defProp(_this, '__imports__', {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    });

    _this.on('module.destroy', this.destroy.bind(_this));
  }

  Scope.prototype = {
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
     * @return {(Galaxy.View | Galaxy.Router | any)}
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
      delProp(this, 'data');
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

  return Scope;
})();

/* global Galaxy */
Galaxy.GalaxyURI = /** @class */ (function () {
  /**
   *
   * @param {string} url
   * @constructor
   */
  function GalaxyURI(url) {
    let urlParser = document.createElement('a');
    urlParser.href = url;
    let myRegexp = /\/([^\t\n]+\/)/g;
    let match = myRegexp.exec(urlParser.pathname);

    this.parsedURL = urlParser.href;
    this.path = match ? match[1] : '/';
    this.base = window.location.pathname;
    this.protocol = urlParser.protocol;
  }

  return GalaxyURI;
})();

/* global Galaxy */
Galaxy.View = /** @class */(function (G) {
  const def_prop = Object.defineProperty;
  const obj_keys = Object.keys;
  const arr_concat = Array.prototype.concat.bind([]);
  // Extracted from MDN
  const VALID_TAG_NAMES = [
    'text',
    'comment',
    //
    'a',
    'abbr',
    'acronym',
    'address',
    'applet',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'basefont',
    'bdi',
    'bdo',
    'bgsound',
    'big',
    'blink',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'center',
    'cite',
    'code',
    'col',
    'colgroup',
    'content',
    'data',
    'datalist',
    'dd',
    'decorator',
    'del',
    'details',
    'dfn',
    'dir',
    'div',
    'dl',
    'dt',
    'element',
    'em',
    'embed',
    'fieldset',
    'figcaption',
    'figure',
    'font',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'ins',
    'isindex',
    'kbd',
    'keygen',
    'label',
    'legend',
    'li',
    'link',
    'listing',
    'main',
    'map',
    'mark',
    'marquee',
    'menu',
    'menuitem',
    'meta',
    'meter',
    'nav',
    'nobr',
    'noframes',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'plaintext',
    'pre',
    'progress',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'script',
    'section',
    'select',
    'shadow',
    'small',
    'source',
    'spacer',
    'span',
    'strike',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'template',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'tt',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
    'xmp'
  ];

  const ARG_BINDING_SINGLE_QUOTE_RE = /=\s*'<([^\[\]<>]*)>(.*)'/m;
  const ARG_BINDING_DOUBLE_QUOTE_RE = /=\s*'=\s*"<([^\[\]<>]*)>(.*)"/m;
  const FUNCTION_HEAD_RE = /^\(\s*([^)]+?)\s*\)|^function.*\(\s*([^)]+?)\s*\)/m;
  const BINDING_RE = /^<([^\[\]<>]*)>\s*([^<>]*)\s*$|^=\s*([^\[\]<>]*)\s*$/;
  const PROPERTY_NAME_SPLITTER_RE = /\.|\[([^\[\]\n]+)]|([^.\n\[\]]+)/g;

  function apply_node_dataset(node, value) {
    if (typeof value === 'object' && value !== null) {
      const stringifyValue = {};
      for (const key in value) {
        const val = value[key];
        if (typeof val === 'object') {
          stringifyValue[key] = JSON.stringify(val);
        } else {
          stringifyValue[key] = val;
        }
      }
      Object.assign(node.dataset, stringifyValue);
    } else {
      node.dataset = null;
    }
  }

  //------------------------------

  Array.prototype.createDataMap = function (keyPropertyName, valuePropertyName) {
    const map = {};
    for (let i = 0, len = this.length; i < len; i++) {
      const item = this[i];
      map[item[keyPropertyName]] = item[valuePropertyName];
    }

    return map;
  };

  View.EMPTY_CALL = function EMPTY_CALL() {
  };

  View.GET_MAX_INDEX = function () {
    return '@' + performance.now();
  };

  /**
   *
   * @typedef {Object} Galaxy.View.BlueprintProperty
   * @property {string} [key]
   * @property {'attr'|'prop'|'reactive'|'event'} [type]
   * @property {Function} [getConfig]
   * @property {Function} [install]
   * @property {Function} [beforeActivate]
   * @property {Function} [getSetter]
   * @property {Function} [update]
   */

  View.REACTIVE_BEHAVIORS = {
    data: true
  };

  View.COMPONENTS = {};
  /**
   *
   * @type {{[property: string]: Galaxy.View.BlueprintProperty}}
   */
  View.NODE_BLUEPRINT_PROPERTY_MAP = {
    tag: {
      type: 'none'
    },
    props: {
      type: 'none'
    },
    children: {
      type: 'none'
    },
    data_3: {
      type: 'none',
      key: 'data',
    },
    data_8: {
      type: 'none',
      key: 'data',
    },
    html: {
      type: 'prop',
      key: 'innerHTML'
    },
    data: {
      type: 'reactive',
      key: 'data',
      getConfig: function (scope, value) {
        if (value !== null && (typeof value !== 'object' || value instanceof Array)) {
          throw new Error('data property should be an object with explicits keys:\n' + JSON.stringify(this.blueprint, null, '  '));
        }

        return {
          reactiveData: null,
          subjects: value,
          scope: scope
        };
      },
      install: function (config) {
        if (config.scope.data === config.subjects) {
          throw new Error('It is not allowed to use Scope.data as data value');
        }

        if (!this.blueprint.module) {
          config.reactiveData = G.View.bind_subjects_to_data(this, config.subjects, config.scope, true);
          const observer = new G.Observer(config.reactiveData);
          observer.onAll(() => {
            apply_node_dataset(this.node, config.reactiveData);
          });

          return;
        }

        Object.assign(this.data, config.subjects);
        return false;
      },
      update: function (config, value, expression) {
        if (expression) {
          value = expression();
        }

        if (config.subjects === value) {
          value = config.reactiveData;
        }

        apply_node_dataset(this.node, value);
      }
    },
    onchange: {
      type: 'event'
    },
    onclick: {
      type: 'event'
    },
    ondblclick: {
      type: 'event'
    },
    onmouseover: {
      type: 'event'
    },
    onmouseout: {
      type: 'event'
    },
    onkeydown: {
      type: 'event'
    },
    onkeypress: {
      type: 'event'
    },
    onkeyup: {
      type: 'event'
    },
    onmousedown: {
      type: 'event'
    },
    onmouseup: {
      type: 'event'
    },
    onload: {
      type: 'event'
    },
    onabort: {
      type: 'event'
    },
    onerror: {
      type: 'event'
    },
    onfocus: {
      type: 'event'
    },
    onblur: {
      type: 'event'
    },
    onreset: {
      type: 'event'
    },
    onsubmit: {
      type: 'event'
    },
  };

  View.PROPERTY_SETTERS = {
    'none': function () {
      return View.EMPTY_CALL;
    }
  };

  // let opt_count = 0;
  // const _next_batch = function (_jump, dirty) {
  //   if (dirty) {
  //     return _jump();
  //   }
  //
  //   if (opt_count > 233) {
  //     opt_count = 0;
  //     // console.log(performance.now());
  //     return requestAnimationFrame(() => {
  //       if (dirty) {
  //         return _jump();
  //       }
  //
  //       if (this.length) {
  //         this.shift()(_next_batch.bind(this, _jump));
  //       } else {
  //         _jump();
  //       }
  //     });
  //   }
  //
  //   opt_count++;
  //   if (this.length) {
  //     this.shift()(_next_batch.bind(this, _jump));
  //   } else {
  //     _jump();
  //   }
  // };

  /**
   *
   * @param data
   * @param {string} properties
   * @return {*}
   */
  function safe_property_lookup(data, properties) {
    properties = properties.split('.');
    let property = properties[0];
    const original = data;
    let target = data;
    let temp = data;
    // var nestingLevel = 0;
    if (data[property] === undefined) {
      while (temp.__parent__) {
        if (temp.__parent__.hasOwnProperty(property)) {
          target = temp.__parent__;
          break;
        }

        temp = temp.__parent__;
      }

      // if the property is not found in the parents then return the original object as the context
      if (target[property] === undefined) {
        target = original;
      }
    }

    target = target || {};
    const lastIndex = properties.length - 1;
    properties.forEach(function (key, i) {
      target = target[key];

      if (i !== lastIndex && !(target instanceof Object)) {
        target = {};
      }
    });

    if (target instanceof G.View.ArrayChange) {
      return target.getInstance();
    }

    return target === undefined ? null : target;
  }

  const dom_manipulation_table = View.DOM_MANIPLATION = {};
  const create_order = [], destroy_order = [];
  let dom_manipulation_order = [];
  let manipulation_done = true, dom_manipulations_dirty = false;
  let diff = 0, preTS = 0, too_many_jumps;

  const next_action = function (_jump, dirty) {
    if (dirty) {
      return _jump();
    }

    if (this.length) {
      this.shift()(next_action.bind(this, _jump));
    } else {
      _jump();
    }
  };

  const next_batch_body = function () {
    if (this.length) {
      let key = this.shift();
      let batch = dom_manipulation_table[key];
      if (!batch.length) {
        return next_batch.call(this);
      }

      next_action.call(batch, next_batch.bind(this), dom_manipulations_dirty);
    } else {
      manipulation_done = true;
      preTS = 0;
      diff = 0;
    }
  };

  const next_batch = function () {
    if (dom_manipulations_dirty) {
      dom_manipulations_dirty = false;
      diff = 0;
      return next_batch.call(dom_manipulation_order);
    }

    const now = performance.now();
    preTS = preTS || now;
    diff = diff + (now - preTS);
    preTS = now;

    if (diff > 2) {
      diff = 0;
      if (too_many_jumps) {
        clearTimeout(too_many_jumps);
        too_many_jumps = null;
      }

      too_many_jumps = setTimeout((ts) => {
        preTS = ts;
        next_batch_body.call(this);
      });
    } else {
      next_batch_body.call(this);
    }
  };

  function comp_asc(a, b) {
    return a > b;
  }

  function comp_desc(a, b) {
    return a < b;
  }

  function binary_search(array, key, _fn) {
    let start = 0;
    let end = array.length - 1;
    let index = 0;

    while (start <= end) {
      let middle = Math.floor((start + end) / 2);
      let midVal = array[middle];

      if (_fn(key, midVal)) {
        // continue searching to the right
        index = start = middle + 1;
      } else {
        // search searching to the left
        index = middle;
        end = middle - 1;
      }
    }

    return index;
  }

  function pos_asc(array, el) {
    if (el < array[0]) {
      return 0;
    }

    if (el > array[array.length - 1]) {
      return array.length;
    }

    return binary_search(array, el, comp_asc);
  }

  function pos_desc(array, el) {
    if (el > array[0]) {
      return 0;
    }

    if (el < array[array.length - 1]) {
      return array.length;
    }

    return binary_search(array, el, comp_desc);
  }

  function add_dom_manipulation(index, act, order, search) {
    if (index in dom_manipulation_table) {
      dom_manipulation_table[index].push(act);
    } else {
      dom_manipulation_table[index] = [act];
      order.splice(search(order, index), 0, index);
    }
  }

  let last_dom_manipulation_id = 0;

  function update_dom_manipulation_order() {
    if (last_dom_manipulation_id !== 0) {
      clearTimeout(last_dom_manipulation_id);
      last_dom_manipulation_id = 0;
    }

    dom_manipulation_order = arr_concat(destroy_order, create_order);
    last_dom_manipulation_id = setTimeout(() => {
      if (manipulation_done) {
        manipulation_done = false;
        next_batch.call(dom_manipulation_order);
      }
    });
  }

  // function update_on_animation_frame() {
  //   if (last_dom_manipulation_id) {
  //     clearTimeout(last_dom_manipulation_id);
  //     last_dom_manipulation_id = null;
  //   }
  //
  //   dom_manipulation_order = arrConcat(destroy_order, create_order);
  //   last_dom_manipulation_id = setTimeout(() => {
  //     if (manipulation_done) {
  //       manipulation_done = false;
  //       next_batch.call(dom_manipulation_order);
  //     }
  //   });
  // }
  //
  // function update_on_timeout() {
  //   if (last_dom_manipulation_id) {
  //     cancelAnimationFrame(last_dom_manipulation_id);
  //     last_dom_manipulation_id = null;
  //   }
  //
  //   dom_manipulation_order = arrConcat(destroy_order, create_order);
  //   last_dom_manipulation_id = requestAnimationFrame(() => {
  //     if (manipulation_done) {
  //       manipulation_done = false;
  //       next_batch.call(dom_manipulation_order);
  //     }
  //   });
  // }

  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.destroy_in_next_frame = function (index, action) {
    dom_manipulations_dirty = true;
    add_dom_manipulation('<' + index, action, destroy_order, pos_desc);
    update_dom_manipulation_order();
  };

  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.create_in_next_frame = function (index, action) {
    dom_manipulations_dirty = true;
    add_dom_manipulation('>' + index, action, create_order, pos_asc);
    update_dom_manipulation_order();
  };

  /**
   *
   * @param {Array<Galaxy.View.ViewNode>} toBeRemoved
   * @param {boolean} hasAnimation
   * @memberOf Galaxy.View
   * @static
   */
  View.destroy_nodes = function (toBeRemoved, hasAnimation) {
    let remove = null;

    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      remove.destroy(hasAnimation);
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param value
   * @param name
   */
  View.set_attr = function set_attr(viewNode, value, name) {
    if (value !== null && value !== undefined && value !== false) {
      viewNode.node.setAttribute(name, value === true ? '' : value);
    } else {
      viewNode.node.removeAttribute(name);
    }
  };

  View.set_prop = function set_prop(viewNode, value, name) {
    viewNode.node[name] = value;
  };

  View.create_child_scope = function (parent) {
    let result = {};

    def_prop(result, '__parent__', {
      enumerable: false,
      value: parent
    });

    def_prop(result, '__scope__', {
      enumerable: false,
      value: parent.__scope__ || parent
    });

    return result;
  };

  /**
   *
   * @param {string|Array} value
   * @return {{propertyKeys: *[], propertyValues: *[], bindTypes: *[], isExpression: boolean, expressionFn: null}}
   */
  View.get_bindings = function (value) {
    let propertyKeys = [];
    let propertyValues = [];
    let bindTypes = [];
    let isExpression = false;
    const valueType = typeof (value);
    let expressionFunction = null;

    if (valueType === 'string') {
      const props = value.match(BINDING_RE);
      if (props) {
        bindTypes = [props[1]];
        propertyKeys = [props[2]];
        propertyValues = [value];
      }
    } else if (valueType === 'function') {
      isExpression = true;
      expressionFunction = value;
      const matches = value.toString().match(FUNCTION_HEAD_RE);
      if (matches) {
        const args = matches[1] || matches [2];
        propertyValues = args.split(',').map(a => {
          const argDef = a.indexOf('"') === -1 ? a.match(ARG_BINDING_SINGLE_QUOTE_RE) : a.match(ARG_BINDING_DOUBLE_QUOTE_RE);
          if (argDef) {
            bindTypes.push(argDef[1]);
            propertyKeys.push(argDef[2]);
            return '<>' + argDef[2];
          } else {
            return undefined;
          }
        });
      }
    }

    return {
      propertyKeys: propertyKeys,
      propertyValues: propertyValues,
      bindTypes: bindTypes,
      handler: expressionFunction,
      isExpression: isExpression,
      expressionFn: null
    };
  };

  View.property_lookup = function (data, key) {
    key = key.split('.');
    let firstKey = key[0];
    const original = data;
    let target = data;
    let temp = data;
    let nestingLevel = 0;
    let parent;
    if (data[firstKey] === undefined) {
      while (temp.__parent__) {
        parent = temp.__parent__;
        if (parent.hasOwnProperty(firstKey)) {
          target = parent;
          break;
        }

        if (nestingLevel++ >= 1000) {
          throw Error('Maximum nested property lookup has reached `' + firstKey + '`\n' + data);
        }

        temp = parent;
      }

      // if the property is not found in the parents then return the original object as the context
      if (target[firstKey] === undefined) {
        return original;
      }
    }

    return target;
  };

  /**
   *
   * @param data
   * @param absoluteKey
   * @returns {Galaxy.View.ReactiveData}
   */
  View.property_rd_lookup = function (data, absoluteKey) {
    const keys = absoluteKey.split('.');
    const li = keys.length - 1;
    let target = data;
    keys.forEach(function (p, i) {
      target = View.property_lookup(target, p);

      if (i !== li) {
        if (!target[p]) {
          const rd = target.__rd__.refs.filter(ref => ref.shadow[p])[0];
          target = rd.shadow[p].data;
        } else {
          target = target[p];
        }
      }
    });

    return target.__rd__;
  };

  View.EXPRESSION_ARGS_FUNC_CACHE = {};

  View.create_args_provider_fn = function (propertyValues) {
    const id = propertyValues.join();

    if (View.EXPRESSION_ARGS_FUNC_CACHE[id]) {
      return View.EXPRESSION_ARGS_FUNC_CACHE[id];
    }

    let functionContent = 'return [';
    let middle = [];
    for (let i = 0, len = propertyValues.length; i < len; i++) {
      const val = propertyValues[i];
      if (typeof val === 'string') {
        if (val.indexOf('<>this.') === 0) {
          middle.push('_prop(this.data, "' + val.replace('<>this.', '') + '")');
        } else if (val.indexOf('<>') === 0) {
          middle.push('_prop(scope, "' + val.replace('<>', '') + '")');
        }
      } else {
        middle.push('_var[' + i + ']');
      }
    }
    functionContent += middle.join(',') + ']';

    const func = new Function('scope, _prop , _var', functionContent);
    View.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  View.create_expression_fn = function (host, scope, handler, keys, values) {
    if (!values[0]) {
      if (host instanceof G.View.ViewNode) {
        values[0] = host.data;
      } else {
        values[0] = scope;
      }
    }

    const getExpressionArguments = G.View.create_args_provider_fn(values);

    return function () {
      let args = [];
      try {
        args = getExpressionArguments.call(host, scope, safe_property_lookup, values);
      } catch (ex) {
        console.error('Can\'t find the property: \n' + keys.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
          ' of its property.\n\n', scope, '\n', ex);
      }

      return handler.apply(host, args);
    };
  };

  /**
   *
   * @param bindings
   * @param target
   * @param scope
   * @returns {Function|boolean}
   */
  View.get_expression_fn = function (bindings, target, scope) {
    if (!bindings.isExpression) {
      return false;
    }

    if (bindings.expressionFn) {
      return bindings.expressionFn;
    }

    // Generate expression arguments
    try {
      bindings.expressionFn = G.View.create_expression_fn(target, scope, bindings.handler, bindings.propertyKeys, bindings.propertyValues);
      return bindings.expressionFn;
    } catch (exception) {
      throw Error(exception.message + '\n' + bindings.propertyKeys);
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode | Object} target
   * @param {String} targetKeyName
   * @param {Galaxy.View.ReactiveData} hostReactiveData
   * @param {Galaxy.View.ReactiveData} scopeData
   * @param {Object} bindings
   * @param {Galaxy.View.ViewNode | undefined} root
   */
  View.make_binding = function (target, targetKeyName, hostReactiveData, scopeData, bindings, root) {
    const propertyKeys = bindings.propertyKeys;
    const expressionFn = View.get_expression_fn(bindings, root, scopeData);
    const G_View_ReactiveData = G.View.ReactiveData;

    let propertyScopeData = scopeData;
    let propertyKey = null;
    let childPropertyKeyPath = null;
    let initValue = null;
    let propertyKeyPathItems = [];
    for (let i = 0, len = propertyKeys.length; i < len; i++) {
      propertyKey = propertyKeys[i];
      childPropertyKeyPath = null;
      const bindType = bindings.bindTypes[i];
      let matches = propertyKey.match(PROPERTY_NAME_SPLITTER_RE);
      propertyKeyPathItems = matches.filter(a => a !== '' && a !== '.');

      if (propertyKeyPathItems.length > 1) {
        propertyKey = propertyKeyPathItems[0];
        childPropertyKeyPath = propertyKeyPathItems.slice(1).join('.');
      }

      if (!hostReactiveData && scopeData /*&& !(scopeData instanceof G.Scope)*/) {
        if ('__rd__' in scopeData) {
          hostReactiveData = scopeData.__rd__;
        } else {
          hostReactiveData = new G_View_ReactiveData(null, scopeData, scopeData instanceof Galaxy.Scope ? scopeData.systemId : 'child');
        }
      }

      if (propertyKeyPathItems[0] === 'Scope') {
        throw new Error('`Scope` keyword must be omitted when it is used  used in bindings: ' + propertyKeys.join('.'));
      }

      if (propertyKey.indexOf('[') === 0) {
        propertyKey = propertyKey.substring(1, propertyKey.length - 1);
      }

      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (propertyKeyPathItems[0] === 'this' && propertyKey === 'this' && root instanceof G.View.ViewNode) {
        propertyKey = propertyKeyPathItems[1];
        bindings.propertyKeys = propertyKeyPathItems.slice(2);
        childPropertyKeyPath = null;
        hostReactiveData = new G_View_ReactiveData('data', root.data, 'this');
        propertyScopeData = View.property_lookup(root.data, propertyKey);
      } else if (propertyScopeData) {
        // Look for the property host object in scopeData hierarchy
        propertyScopeData = View.property_lookup(propertyScopeData, propertyKey);
      }

      initValue = propertyScopeData;
      if (propertyScopeData !== null && typeof propertyScopeData === 'object') {
        initValue = propertyScopeData[propertyKey];
      }

      let reactiveData;
      if (initValue instanceof Object) {
        reactiveData = new G_View_ReactiveData(propertyKey, initValue, hostReactiveData || scopeData.__scope__.__rd__);
      } else if (childPropertyKeyPath) {
        reactiveData = new G_View_ReactiveData(propertyKey, null, hostReactiveData);
      } else if (hostReactiveData) {
        // if the propertyKey is used for a repeat reactive property, then we assume its type is Array.
        hostReactiveData.addKeyToShadow(propertyKey, targetKeyName === 'repeat');
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof G.View.ViewNode)) {
          def_prop(target, targetKeyName, {
            set: function ref_set(newValue) {
              // console.warn('It is not allowed', hostReactiveData, targetKeyName);
              // Not sure about this part
              // This will provide binding to primitive data types as well.
              if (expressionFn) {
                // console.log(newValue, target[targetKeyName], targetKeyName, propertyKey);
                // console.warn('It is not allowed to set value for an expression', targetKeyName, newValue);
                return;
              }

              if (hostReactiveData.data[propertyKey] === newValue) {
                return;
              }

              hostReactiveData.data[propertyKey] = newValue;
            },
            get: function ref_get() {
              if (expressionFn) {
                return expressionFn();
              }

              return hostReactiveData.data[propertyKey];
            },
            enumerable: true,
            configurable: true
          });
        }

        if (hostReactiveData && scopeData instanceof G.Scope) {
          // If the propertyKey is referring to some local value then there is no error
          if (target instanceof G.View.ViewNode && target.localPropertyNames.has(propertyKey)) {
            return;
          }

          // throw new Error('Binding to Scope direct properties is not allowed.\n' +
          //   'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.parsedURL + '\nProperty name: `' +
          //   propertyKey + '`\n');
        }

        hostReactiveData.addNode(target, targetKeyName, propertyKey, bindType, expressionFn);
      }

      if (childPropertyKeyPath !== null) {
        View.make_binding(target, targetKeyName, reactiveData, initValue, Object.assign({}, bindings, { propertyKeys: [childPropertyKeyPath] }), root);
      }
    }

  };

  /**
   * Bind subjects to the data and takes care of dependent objects
   * @param viewNode
   * @param subjects
   * @param data
   * @param cloneSubject
   * @returns {*}
   */
  View.bind_subjects_to_data = function (viewNode, subjects, data, cloneSubject) {
    const keys = obj_keys(subjects);
    let attributeName;
    let attributeValue;
    const subjectsClone = cloneSubject ? G.clone(subjects) : subjects;

    let parentReactiveData;
    if (!(data instanceof G.Scope)) {
      parentReactiveData = new G.View.ReactiveData(null, data, 'BSTD');
    }

    for (let i = 0, len = keys.length; i < len; i++) {
      attributeName = keys[i];
      attributeValue = subjectsClone[attributeName];

      // Object that have __singleton property will be ignored
      if (attributeValue.__singleton__) {
        continue;
      }

      // if (attributeValue instanceof Galaxy.Router) {
      //   console.log(attributeName, attributeValue)
      //   continue;
      // }

      const bindings = View.get_bindings(attributeValue);
      if (bindings.propertyKeys.length) {
        View.make_binding(subjectsClone, attributeName, parentReactiveData, data, bindings, viewNode);
        if (viewNode) {
          bindings.propertyKeys.forEach(function (path) {
            try {
              const rd = View.property_rd_lookup(data, path);
              viewNode.finalize.push(() => {
                rd.removeNode(subjectsClone);
              });
            } catch (error) {
              console.error('bind_subjects_to_data -> Could not find: ' + path + '\n in', data, error);
            }
          });
        }
      }

      if (attributeValue && typeof attributeValue === 'object' && !(attributeValue instanceof Array)) {
        View.bind_subjects_to_data(viewNode, attributeValue, data);
      }
    }

    return subjectsClone;
  };

  /**
   *
   * @param {string} blueprintKey
   * @param {Galaxy.View.ViewNode} node
   * @param {string} key
   * @param scopeData
   * @return boolean
   */
  View.install_property_for_node = function (key, value, node, scopeData) {
    if (key in View.REACTIVE_BEHAVIORS) {
      if (value === null || value === undefined) {
        return false;
      }

      const reactiveProperty = View.NODE_BLUEPRINT_PROPERTY_MAP[key];
      const data = reactiveProperty.getConfig.call(node, scopeData, node.blueprint[key]);
      if (data !== undefined) {
        node.cache[key] = data;
      }

      return reactiveProperty.install.call(node, data);
    }

    return true;
  };

  /**
   *
   * @param viewNode
   * @param {string} propertyKey
   * @param {Galaxy.View.ReactiveData} scopeProperty
   * @param expression
   */
  View.activate_property_for_node = function (viewNode, propertyKey, scopeProperty, expression) {
    /**
     *
     * @type {Galaxy.View.BlueprintProperty}
     */
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey] || { type: 'attr' };
    property.key = property.key || propertyKey;
    if (typeof property.beforeActivate !== 'undefined') {
      property.beforeActivate(viewNode, scopeProperty, propertyKey, expression);
    }

    viewNode.setters[propertyKey] = View.get_property_setter_for_node(property, viewNode, scopeProperty, expression);
  };

  /**
   *
   * @param {Galaxy.View.BlueprintProperty} blueprintProperty
   * @param {Galaxy.View.ViewNode} viewNode
   * @param [scopeProperty]
   * @param {Function} [expression]
   * @returns {Galaxy.View.EMPTY_CALL|(function())}
   */
  View.get_property_setter_for_node = function (blueprintProperty, viewNode, scopeProperty, expression) {
    // if viewNode is virtual, then the expression should be ignored
    if (blueprintProperty.type !== 'reactive' && viewNode.virtual) {
      return View.EMPTY_CALL;
    }
    // This is the lowest level where the developer can modify the property setter behavior
    // By defining 'createSetter' for the property you can implement your custom functionality for setter
    if (typeof blueprintProperty.getSetter !== 'undefined') {
      return blueprintProperty.getSetter(viewNode, blueprintProperty, blueprintProperty, expression);
    }

    return View.PROPERTY_SETTERS[blueprintProperty.type](viewNode, blueprintProperty, expression);
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {string} propertyKey
   * @param {*} value
   */
  View.set_property_for_node = function (viewNode, propertyKey, value) {
    const bpKey = propertyKey + '_' + viewNode.node.nodeType;
    let property = View.NODE_BLUEPRINT_PROPERTY_MAP[bpKey] || View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey];
    if (!property) {
      property = { type: 'prop' };
      if (!(propertyKey in viewNode.node) && 'setAttribute' in viewNode.node) {
        property = { type: 'attr' };
      }

      View.NODE_BLUEPRINT_PROPERTY_MAP[bpKey] = property;
    }

    property.key = property.key || propertyKey;

    switch (property.type) {
      case 'attr':
      case 'prop':
      case 'reactive':
        View.get_property_setter_for_node(property, viewNode)(value, null);
        break;

      case 'event':
        viewNode.node[propertyKey] = function (event) {
          value.call(viewNode, event, viewNode.data);
        };
        break;
    }
  };

  /**
   *
   * @param {Galaxy.Scope} scope
   * @constructor
   * @memberOf Galaxy
   */
  function View(scope) {
    const _this = this;
    _this.scope = scope;

    if (scope.element instanceof G.View.ViewNode) {
      _this.container = scope.element;
      // Nested views should inherit components from their parent view
      _this._components = Object.assign({}, scope.element.view._components);
    } else {
      _this.container = new G.View.ViewNode({
        tag: scope.element
      }, null, _this);

      _this.container.setInDOM(true);
    }
  }

  function TimelineControl(type) {
    this.type = type;
  }

  TimelineControl.prototype.startKeyframe = function (timeline, position) {
    if (!timeline) {
      throw new Error('Argument Missing: view.' + this.type + '.start(timeline:string) needs a `timeline`');
    }

    position = position || '+=0';

    const animations = {
      [this.type]: {
        // keyframe: true,
        to: {
          data: 'timeline:start',
          duration: 0.001
        },
        timeline,
        position
      }
    };

    return {
      tag: 'comment',
      text: ['', this.type + ':timeline:start', 'position: ' + position, 'timeline: ' + timeline, ''].join('\n'),
      animations
    };
  };

  TimelineControl.prototype.addKeyframe = function (onComplete, timeline, position) {
    if (!timeline) {
      throw new Error('Argument Missing: view.' + this.type + '.add(timeline:string) needs a `timeline`');
    }

    const animations = {
      [this.type]: {
        // keyframe: true,
        to: {
          duration: 0.001,
          onComplete
        },
        timeline,
        position,
      }
    };

    return {
      tag: 'comment',
      text: this.type + ':timeline:keyframe',
      animations
    };
  };

  View.prototype = {
    _components: {},
    components: function (map) {
      for (const key in map) {
        const comp = map[key];
        if (typeof comp !== 'function') {
          throw new Error('Component must be type of function: ' + key);
        }

        this._components[key] = comp;
      }
    },
    /**
     *
     */
    entering: new TimelineControl('enter'),

    leaving: new TimelineControl('leave'),

    /**
     *
     * @param {string} key
     * @param blueprint
     * @param {Galaxy.Scope|Object} scopeData
     * @returns {*}
     */
    getComponent: function (key, blueprint, scopeData) {
      let componentScope = scopeData;
      let componentBlueprint = blueprint;
      if (key) {
        if (key in this._components) {
          if (blueprint.props && typeof blueprint.props !== 'object') {
            throw new Error('The `props` must be a literal object.');
          }

          componentScope = View.create_child_scope(scopeData);
          Object.assign(componentScope, blueprint.props || {});

          View.bind_subjects_to_data(null, componentScope, scopeData);
          componentBlueprint = this._components[key].call(null, componentScope, blueprint, this);
          if (blueprint instanceof Array) {
            throw new Error('A component\'s blueprint can NOT be an array. A component must have only one root node.');
          }
        } else if (VALID_TAG_NAMES.indexOf(key) === -1) {
          console.warn('Invalid component/tag: ' + key);
        }
      }

      return {
        blueprint: Object.assign(blueprint, componentBlueprint),
        scopeData: componentScope
      };
    },

    /**
     *
     * @param {{enter?: AnimationConfig, leave?:AnimationConfig}} animations
     * @returns Blueprint
     */
    addTimeline: function (animations) {
      return {
        tag: 'comment',
        text: 'timeline',
        animations
      };
    },

    /**
     *
     * @param {Blueprint|Blueprint[]} blueprint
     * @return {Galaxy.View.ViewNode|Array<Galaxy.View.ViewNode>}
     */
    blueprint: function (blueprint) {
      const _this = this;
      return this.createNode(blueprint, _this.scope, _this.container, null);
    },
    /**
     *
     * @param {boolean} [hasAnimation]
     */
    clean: function (hasAnimation) {
      this.container.clean(hasAnimation);
    },
    dispatchEvent: function (event) {
      this.container.dispatchEvent(event);
    },
    /**
     *
     * @param {Object} blueprint
     * @param {Object} scopeData
     * @param {Galaxy.View.ViewNode} parent
     * @param {Node|Element|null} position
     * @return {Galaxy.View.ViewNode|Array<Galaxy.View.ViewNode>}
     */
    createNode: function (blueprint, scopeData, parent, position) {
      const _this = this;
      let i = 0, len = 0;
      if (typeof blueprint === 'string') {
        const content = document.createElement('div');
        content.innerHTML = blueprint;
        const nodes = Array.prototype.slice.call(content.childNodes);
        nodes.forEach(function (node) {
          // parent.node.appendChild(node);
          const viewNode = new G.View.ViewNode({ tag: node }, parent, _this);
          parent.registerChild(viewNode, position);
          node.parentNode.removeChild(node);
          View.set_property_for_node(viewNode, 'animations', {});
          viewNode.setInDOM(true);
        });

        return nodes;
      } else if (typeof blueprint === 'function') {
        return blueprint.call(_this);
      } else if (blueprint instanceof Array) {
        const result = [];
        for (i = 0, len = blueprint.length; i < len; i++) {
          result.push(_this.createNode(blueprint[i], scopeData, parent, null));
        }

        return result;
      } else if (blueprint instanceof Object) {
        const component = _this.getComponent(blueprint.tag, blueprint, scopeData);
        let propertyValue, propertyKey;
        const _blueprint = component.blueprint;
        const keys = obj_keys(_blueprint);
        const needInitKeys = [];
        const viewNode = new G.View.ViewNode(_blueprint, parent, _this, component.scopeData);
        parent.registerChild(viewNode, position);

        // Behaviors installation stage
        for (i = 0, len = keys.length; i < len; i++) {
          propertyKey = keys[i];
          propertyValue = _blueprint[propertyKey];

          const needValueAssign = View.install_property_for_node(propertyKey, propertyValue, viewNode, component.scopeData);
          if (needValueAssign === false) {
            continue;
          }

          needInitKeys.push(propertyKey);
        }

        // Value assignment stage
        for (i = 0, len = needInitKeys.length; i < len; i++) {
          propertyKey = needInitKeys[i];
          if (propertyKey === 'children') continue;

          propertyValue = _blueprint[propertyKey];
          const bindings = View.get_bindings(propertyValue);
          if (bindings.propertyKeys.length) {
            View.make_binding(viewNode, propertyKey, null, component.scopeData, bindings, viewNode);
          } else {
            View.set_property_for_node(viewNode, propertyKey, propertyValue);
          }
        }

        if (!viewNode.virtual) {
          viewNode.setInDOM(true);
          if (_blueprint.children) {
            _this.createNode(_blueprint.children, component.scopeData, viewNode, null);
          }
        }

        return viewNode;
      } else {
        throw Error('blueprint should NOT be null');
      }
    }
  };

  return View;
})(Galaxy);

/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/router', {
  provideInstance: function (scope, module) {
    const router = new Galaxy.Router(scope, module);
    if (module.systemId !== '@root') {
      scope.on('module.destroy', () => router.destroy());
    }

    scope.__router__ = router;
    scope.router = router.data;

    return router;
  },
  startInstance: function (instance) {

  }
});

/* global Galaxy */
Galaxy.Router = /** @class */ (function (G) {
  Router.PARAMETER_NAME_REGEX = new RegExp(/[:*](\w+)/g);
  Router.PARAMETER_NAME_REPLACEMENT = '([^/]+)';
  Router.BASE_URL = '/';
  Router.currentPath = {
    handlers: [],
    subscribe: function (handler) {
      this.handlers.push(handler);
      handler(location.pathname);
    },
    update: function () {
      this.handlers.forEach((h) => {
        h(location.pathname);
      });
    }
  };

  Router.mainListener = function (e) {
    Router.currentPath.update();
  };

  Router.prepareRoute = function (routeConfig, parentScopeRouter, fullPath) {
    if (routeConfig instanceof Array) {
      const routes = routeConfig.map((r) => Router.prepareRoute(r, parentScopeRouter, fullPath));
      if (parentScopeRouter) {
        parentScopeRouter.activeRoute.children = routes;
      }

      return routes;
    }

    return {
      ...routeConfig,
      fullPath: fullPath + routeConfig.path,
      active: false,
      hidden: routeConfig.hidden || Boolean(routeConfig.redirectTo) || false,
      viewports: routeConfig.viewports || {},
      parent: parentScopeRouter ? parentScopeRouter.activeRoute : null,
      children: routeConfig.children || []
    };
  };

  Router.extract_dynamic_routes = function (routesPath) {
    return routesPath.map(function (route) {
      const paramsNames = [];

      // Find all the parameters names in the route
      let match = Router.PARAMETER_NAME_REGEX.exec(route);
      while (match) {
        paramsNames.push(match[1]);
        match = Router.PARAMETER_NAME_REGEX.exec(route);
      }

      if (paramsNames.length) {
        return {
          id: route,
          paramNames: paramsNames,
          paramFinderExpression: new RegExp(route.replace(Router.PARAMETER_NAME_REGEX, Router.PARAMETER_NAME_REPLACEMENT))
        };
      }

      return null;
    }).filter(Boolean);
  },

    window.addEventListener('popstate', Router.mainListener);

  /**
   *
   * @param {Galaxy.Scope} scope
   * @param {Galaxy.Module} module
   * @constructor
   * @memberOf Galaxy
   */
  function Router(scope, module) {
    const _this = this;
    _this.__singleton__ = true;
    _this.config = {
      baseURL: Router.BASE_URL
    };
    _this.scope = scope;
    _this.module = module;
    _this.routes = [];
    // Find active parent router
    _this.parentScope = scope.parentScope;
    _this.parentRouter = scope.parentScope ? scope.parentScope.__router__ : null;

    // ToDo: bug
    // Find the next parent router if there is no direct parent router
    if (_this.parentScope && (!_this.parentScope.router || !_this.parentScope.router.activeRoute)) {
      let _parentScope = _this.parentScope;
      while (!_parentScope.router || !_parentScope.router.activeRoute) {
        _parentScope = _parentScope.parentScope;
      }
      _this.config.baseURL = _parentScope.router.activePath;
      _this.parentScope = _parentScope;
    }

    _this.path = _this.parentScope && _this.parentScope.router ? _this.parentScope.router.activeRoute.path : '/';
    _this.fullPath = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;
    _this.parentRoute = null;
    _this.oldURL = '';
    _this.resolvedRouteValue = null;
    _this.resolvedDynamicRouteValue = null;
    _this.routesMap = null;
    _this.data = {
      routes: [],
      navs: [],
      activeRoute: null,
      activePath: null,
      activeModule: null,
      viewports: {
        main: null,
      },
      parameters: _this.parentScope && _this.parentScope.router ? _this.parentScope.router.parameters : {}
    };
    _this.onTransitionFn = Galaxy.View.EMPTY_CALL;
    _this.onInvokeFn = Galaxy.View.EMPTY_CALL;
    _this.onLoadFn = Galaxy.View.EMPTY_CALL;
    _this.viewports = {
      main: {
        tag: 'div',
        module: '<>router.activeModule'
      }
    };

    Object.defineProperty(this, 'urlParts', {
      get: function () {
        return _this.oldURL.split('/').slice(1);
      },
      enumerable: true
    });

    if (module.id === '@root') {
      Router.currentPath.update();
    }
  }

  Router.prototype = {
    setup: function (routeConfigs) {
      this.routes = Router.prepareRoute(routeConfigs, this.parentScope ? this.parentScope.router : null, this.fullPath === '/' ? '' : this.fullPath);
      if (this.parentScope && this.parentScope.router) {
        this.parentRoute = this.parentScope.router.activeRoute;
      }

      this.routes.forEach(route => {
        const viewportNames = route.viewports ? Object.keys(route.viewports) : [];
        viewportNames.forEach(vp => {
          if (vp === 'main' || this.viewports[vp]) return;

          this.viewports[vp] = {
            tag: 'div',
            module: '<>router.viewports.' + vp
          };
        });
      });

      this.data.routes = this.routes;
      this.data.navs = this.routes.filter(r => !r.hidden);

      return this;
    },

    start: function () {
      this.listener = this.detect.bind(this);
      window.addEventListener('popstate', this.listener);
      this.detect();
    },

    /**
     *
     * @param {string} path
     * @param {boolean} replace
     */
    navigateToPath: function (path, replace) {
      if (typeof path !== 'string') {
        throw new Error('Invalid argument(s) for `navigateToPath`: path must be a string. ' + typeof path + ' is given');
      }

      if (path.indexOf('/') !== 0) {
        throw new Error('Invalid argument(s) for `navigateToPath`: path must be starting with a `/`\nPlease use `/' + path + '` instead of `' + path + '`');
      }

      if (path.indexOf(this.config.baseURL) !== 0) {
        path = this.config.baseURL + path;
      }

      const currentPath = window.location.pathname;
      if (currentPath === path /*&& this.resolvedRouteValue === path*/) {
        return;
      }

      if (replace) {
        history.replaceState({}, '', path);
      } else {
        history.pushState({}, '', path);
      }

      dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    },

    navigate: function (path, replace) {
      if (typeof path !== 'string') {
        throw new Error('Invalid argument(s) for `navigate`: path must be a string. ' + typeof path + ' is given');
      }

      if (path.indexOf('/') !== 0) {
        throw new Error('Invalid argument(s) for `navigate`: path must be starting with a `/`\nPlease use `/' + path + '` instead of `' + path + '`');
      }

      if (path.indexOf(this.path) !== 0) {
        path = this.path + path;
      }

      this.navigateToPath(path, replace);
    },

    navigateToRoute: function (route, replace) {
      let path = route.path;
      if (route.parent) {
        path = route.parent.path + route.path;
      }

      this.navigate(path, replace);
    },

    notFound: function () {

    },

    normalizeHash: function (hash) {
      if (hash.indexOf('#!/') === 0) {
        throw new Error('Please use `#/` instead of `#!/` for you hash');
      }

      let normalizedHash = hash;
      if (hash.indexOf('#/') !== 0) {
        if (hash.indexOf('/') !== 0) {
          normalizedHash = '/' + hash;
        } else if (hash.indexOf('#') === 0) {
          normalizedHash = hash.split('#').join('#/');
        }
      }

      // if (this.config.baseURL !== '/') {
      //   normalizedHash = normalizedHash.replace(this.config.baseURL, '');
      // }
      return normalizedHash.replace(this.fullPath, '/').replace('//', '/') || '/';
    },

    onTransition: function (handler) {
      this.onTransitionFn = handler;
      return this;
    },

    onInvoke: function (handler) {
      this.onInvokeFn = handler;
      return this;
    },

    onLoad: function (handler) {
      this.onLoadFn = handler;
      return this;
    },

    findMatchRoute: function (routes, hash, parentParams) {
      const _this = this;
      let matchCount = 0;
      const normalizedHash = _this.normalizeHash(hash);
      const routesPath = routes.map(item => item.path);
      const dynamicRoutes = Router.extract_dynamic_routes(routesPath);
      const staticRoutes = routes.filter(r => dynamicRoutes.indexOf(r) === -1 && normalizedHash.indexOf(r.path) === 0);
      const targetStaticRoute = staticRoutes.length ? staticRoutes.reduce((a, b) => a.path.length > b.path.length ? a : b) : false;

      if (targetStaticRoute && !(normalizedHash !== '/' && targetStaticRoute.path === '/')) {
        const routeValue = normalizedHash.slice(0, targetStaticRoute.path.length);

        if (_this.resolvedRouteValue === routeValue) {
          // static routes don't have parameters
          return Object.assign(_this.data.parameters, _this.createClearParameters());
        }

        _this.resolvedDynamicRouteValue = null;
        _this.resolvedRouteValue = routeValue;

        if (targetStaticRoute.redirectTo) {
          return this.navigate(targetStaticRoute.redirectTo, true);
        }

        matchCount++;
        return _this.callRoute(targetStaticRoute, normalizedHash, _this.createClearParameters(), parentParams);
      }

      for (let i = 0, len = dynamicRoutes.length; i < len; i++) {
        const targetDynamicRoute = dynamicRoutes[i];
        const match = targetDynamicRoute.paramFinderExpression.exec(normalizedHash);

        if (!match) {
          continue;
        }

        matchCount++;
        const params = _this.createParamValueMap(targetDynamicRoute.paramNames, match.slice(1));

        if (_this.resolvedDynamicRouteValue === hash) {
          return Object.assign(_this.data.parameters, params);
        }

        _this.resolvedDynamicRouteValue = hash;
        _this.resolvedRouteValue = null;
        const routeIndex = routesPath.indexOf(targetDynamicRoute.id);
        const pathParameterPlaceholder = targetDynamicRoute.id.split('/').filter(t => t.indexOf(':') !== 0).join('/');
        const parts = hash.replace(pathParameterPlaceholder, '').split('/');
        return _this.callRoute(routes[routeIndex], parts.join('/'), params, parentParams);
      }

      if (matchCount === 0) {
        console.warn('No associated route has been found', hash);
      }
    },

    callRoute: function (newRoute, hash, params, parentParams) {
      const oldRoute = this.data.activeRoute;
      const oldPath = this.data.activePath;
      this.data.activeRoute = newRoute;
      this.data.activePath = newRoute.path;

      this.onTransitionFn.call(this, oldPath, newRoute.path, oldRoute, newRoute);
      if (!newRoute.redirectTo) {
        // if current route's path starts with the old route's path, then the old route should stay active
        if (oldRoute && newRoute.path.indexOf(oldPath) !== 0) {
          oldRoute.active = false;

          if (typeof oldRoute.onLeave === 'function') {
            oldRoute.onLeave.call(null, oldPath, newRoute.path, oldRoute, newRoute);
          }
        }

        newRoute.active = true;
      }

      if (typeof newRoute.onEnter === 'function') {
        newRoute.onEnter.call(null, oldPath, newRoute.path, oldRoute, newRoute);
      }

      if (typeof newRoute.handle === 'function') {
        return newRoute.handle.call(this, params, parentParams);
      } else {
        this.populateViewports(newRoute);

        G.View.create_in_next_frame(G.View.GET_MAX_INDEX(), (_next) => {
          Object.assign(this.data.parameters, params);
          _next();
        });
      }

      return false;
    },

    populateViewports: function (route) {
      let viewportFound = false;
      const allViewports = this.data.viewports;
      for (const key in allViewports) {
        let value = route.viewports[key];
        if (value === undefined) {
          continue;
        }

        if (typeof value === 'string') {
          value = {
            path: value,
            onInvoke: this.onInvokeFn.bind(this, value, key),
            onLoad: this.onLoadFn.bind(this, value, key)
          };
          viewportFound = true;
        }

        if (key === 'main') {
          this.data.activeModule = value;
        }

        this.data.viewports[key] = value;
      }

      if (!viewportFound && this.parentRouter) {
        this.parentRouter.populateViewports(route);
      }
    },

    createClearParameters: function () {
      const clearParams = {};
      const keys = Object.keys(this.data.parameters);
      keys.forEach(k => clearParams[k] = undefined);
      return clearParams;
    },

    createParamValueMap: function (names, values) {
      const params = {};
      names.forEach(function (name, i) {
        params[name] = values[i];
      });

      return params;
    },

    detect: function () {
      const pathname = window.location.pathname;
      const hash = pathname ? pathname.substring(-1) !== '/' ? pathname + '/' : pathname : '/';
      // const hash = pathname || '/';
      const path = this.config.baseURL === '/' ? this.path : this.config.baseURL + this.path;

      if (hash.indexOf(path) === 0) {
        if (hash !== this.oldURL) {
          this.oldURL = hash;
          this.findMatchRoute(this.routes, hash, {});
        }
      }
    },

    getURLParts: function () {
      return this.oldURL.split('/').slice(1);
    },

    destroy: function () {
      if (this.parentRoute) {
        this.parentRoute.children = [];
      }
      window.removeEventListener('popstate', this.listener);
    }
  };

  return Router;
})(Galaxy);

/* global Galaxy */
Galaxy.registerAddOnProvider('galaxy/view', {
  /**
   *
   * @return {Galaxy.View}
   */
  provideInstance: function (scope, module) {
    return new Galaxy.View(scope);
  },
  startInstance: function (instance, module) {

  }

});

(function (GMC) {
  GMC.registerParser('text/css', parser);

  const hosts = {};

  function getHostId(id) {
    if (hosts.hasOwnProperty(id)) {
      return hosts[id];
    }
    const index = Object.keys(hosts).length;
    const ids = {
      host: 'gjs-host-' + index,
      content: 'gjs-content-' + index,
    };

    hosts[id] = ids;

    return ids;
  }

  function rulesForCssText(styleContent) {
    const doc = document.implementation.createHTMLDocument(''),
      styleElement = document.createElement('style');

    styleElement.textContent = styleContent;
    // the style will only be parsed once it is added to a document
    doc.body.appendChild(styleElement);

    return styleElement;
  }

  function applyContentAttr(children, ids) {
    if (!(children instanceof Array) && children !== null && children !== undefined) {
      children = [children];
    }

    children.forEach((child) => {
      if (typeof child === 'string' || child.tag === 'comment') return;
      child[ids.content] = '';

      if (child.children) {
        applyContentAttr(child.children, ids);
      }
    });
  }

  function parser(content) {
    return {
      imports: [],
      source: async function (Scope) {
        const ids = getHostId(Scope.systemId);
        const cssRules = rulesForCssText(content);
        const hostSuffix = '[' + ids.host + ']';
        // const contentSuffix = '[' + ids.content + ']';
        const parsedCSSRules = [];
        const host = /(:host)/g;
        const selector = /([^\s+>~,]+)/g;
        const selectorReplacer = function (item) {
          if (item === ':host') {
            return item;
          }

          return item /*+ contentSuffix*/;
        };

        Array.prototype.forEach.call(cssRules.sheet.cssRules, function (css) {
          let selectorText = css.selectorText.replace(selector, selectorReplacer);

          css.selectorText = selectorText.replace(host, hostSuffix);
          parsedCSSRules.push(css.cssText);
        });
        const parsedCSSText = parsedCSSRules.join('\n');

        Scope.export = {
          _temp: true,
          tag: 'style',
          type: 'text/css',
          id: Scope.systemId,
          text: parsedCSSText,
          _create() {
            const parent = this.parent;
            parent.node.setAttribute(ids.host, '');
            const children = parent.blueprint.children || [];
            applyContentAttr(children, ids);
          }
        };
      }
    };
  }
})(Galaxy.Module.Content);

(function (GMC) {
  GMC.registerParser('default', parser);

  function parser(content) {
    return {
      imports: [],
      source: async function as_text(scope) {
        scope.export = content;
      }
    };
  }
})(Galaxy.Module.Content);

(function (GMC) {
  GMC.registerParser('function', parser);

  function parser(content, metaData) {
    const unique = [];
    let imports = metaData.imports ? metaData.imports.slice(0) : [];
    imports = imports.map(function (item) {
      if (unique.indexOf(item) !== -1) {
        return null;
      }

      unique.push(item);
      return { path: item };
    }).filter(Boolean);

    return {
      imports: imports,
      source: content
    };
  }
})(Galaxy.Module.Content);

(function (GMC) {
  GMC.registerParser('application/javascript', parser);

  function parser(content) {
    const imports = [];
    const unique = [];
    let parsedContent = content.replace(/^\s*\/\/.*$/gm, '').replace(/Scope\.import\(['"](.*)['"]\)/gm, function (match, path) {
      let query = path.match(/(\S+)/gm);
      let pathURL = query[query.length - 1];
      if (unique.indexOf(pathURL) !== -1) {
        return 'Scope.import(\'' + pathURL + '\')';
      }

      unique.push(pathURL);
      imports.push({
        path: pathURL,
        fresh: query.indexOf('new') === 0,
        contentType: null
      });

      return 'Scope.import(\'' + pathURL + '\')';
    });

    parsedContent = parsedContent.replace(/Scope\.importAsText\(['"](.*)['"]\)/gm, function (match, path) {
      let query = path.match(/(\S+)/gm);
      let pathURL = query[query.length - 1] + '#text';
      if (unique.indexOf(pathURL) !== -1) {
        return 'Scope.import(\'' + pathURL + '\')';
      }

      unique.push(pathURL);
      imports.push({
        path: pathURL,
        fresh: true,
        contentType: 'text/plain'
      });

      return 'Scope.import(\'' + pathURL + '\')';
    });

    parsedContent = parsedContent.replace(/Scope\.kill\(.*\)/gm, 'return');

    return {
      imports: imports,
      source: parsedContent,
      native: /^export default/gm.test(parsedContent)
    };
  }
})(Galaxy.Module.Content);

/* global Galaxy */
Galaxy.View.ArrayChange = /** @class */ (function (G) {
  let lastId = 0;

  function ArrayChange() {
    this.id = lastId++;
    if (lastId > 100000000) {
      lastId = 0;
    }
    this.init = null;
    this.original = null;
    // this.snapshot = [];
    this.returnValue = null;
    this.params = [];
    this.type = 'reset';

    // Object.preventExtensions(this);
  }

  ArrayChange.prototype = {
    getInstance: function () {
      const instance = new G.View.ArrayChange();
      instance.init = this.init;
      instance.original = this.original;
      instance.params = this.params.slice(0);
      instance.type = this.type;

      return instance;
    }
  };

  return ArrayChange;
})(Galaxy);

/* global Galaxy */
Galaxy.View.ReactiveData = /** @class */ (function (G) {
  const ARRAY_PROTO = Array.prototype;
  const ARRAY_MUTATOR_METHODS = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
  ];

  const KEYS_TO_REMOVE_FOR_ARRAY = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'changes',
    '__rd__'
  ];
  const objKeys = Object.keys;
  const defProp = Object.defineProperty;
  const scopeBuilder = function (id) {
    return {
      id: id || 'Scope',
      shadow: {},
      data: {},
      notify: function () {
      },
      notifyDown: function () {
      },
      sync: function () {
      },
      makeReactiveObject: function () {
      },
      addKeyToShadow: function () {
      }
    };
  };

  const getKeys = function (obj) {
    if (obj instanceof Array) {
      const keys = ['length'];
      if (obj.hasOwnProperty('changes')) {
        keys.push('changes');
      }
      return keys;
    } else {
      return Object.keys(obj);
    }
  };

  function create_array_value(arr, method, initialChanges) {
    const originalMethod = ARRAY_PROTO[method];
    return function array_value() {
      const __rd__ = this.__rd__;

      let i = arguments.length;
      const args = new Array(i);
      while (i--) {
        args[i] = arguments[i];
      }

      const returnValue = originalMethod.apply(this, args);
      const changes = new G.View.ArrayChange();
      const _original = changes.original = arr;
      changes.type = method;
      changes.params = args;
      changes.returnValue = returnValue;
      changes.init = initialChanges;

      switch (method) {
        case 'push':
        case 'reset':
        case 'unshift':
          const _length = _original.length - 1;
          for (let i = 0, len = changes.params.length; i < len; i++) {
            const item = changes.params[i];
            if (item !== null && typeof item === 'object') {
              new ReactiveData(_length + i, item, __rd__);
            }
          }
          break;

        case 'pop':
        case 'shift':
          if (returnValue !== null && typeof returnValue === 'object' && '__rd__' in returnValue) {
            returnValue.__rd__.removeMyRef();
          }
          break;

        case 'splice':
          changes.params.slice(2).forEach(function (item) {
            if (item !== null && typeof item === 'object') {
              new ReactiveData(_original.indexOf(item), item, __rd__);
            }
          });
          break;
      }

      // repeat reactive property uses array.changes to detect the type of the mutation on array and react properly.
      arr.changes = changes;
      __rd__.notifyDown('length');
      __rd__.notifyDown('changes');
      __rd__.notify(__rd__.keyInParent, this);

      return returnValue;
    };
  }

  const SYNC_NODE = {
    _(node, key, value) {
      // Pass a copy of the ArrayChange to every bound
      if (value instanceof G.View.ArrayChange) {
        value = value.getInstance();
      }

      if (node instanceof G.View.ViewNode) {
        node.setters[key](value);
      } else {
        node[key] = value;
      }

      G.Observer.notify(node, key, value);
    },
    self(node, key, value, sameObjectValue, fromChild) {
      if (fromChild || sameObjectValue)
        return;

      SYNC_NODE._(node, key, value);
    },
    props(node, key, value, sameObjectValue, fromChild) {
      if (!fromChild)
        return;

      SYNC_NODE._(node, key, value);
    },
  };

  function NodeMap() {
    this.keys = [];
    this.nodes = [];
    this.types = [];
  }

  /**
   *
   * @param nodeKey
   * @param node
   * @param bindType
   */
  NodeMap.prototype.push = function (nodeKey, node, bindType) {
    this.keys.push(nodeKey);
    this.nodes.push(node);
    this.types.push(bindType);
  };

  /**
   * @param {string|number} id
   * @param {Object} data
   * @param {Galaxy.View.ReactiveData} p
   * @constructor
   * @memberOf Galaxy.View
   */
  function ReactiveData(id, data, p) {
    const parent = p instanceof ReactiveData ? p : scopeBuilder(p);
    this.data = data;
    this.id = parent.id + (id ? '.' + id : '|Scope');
    this.keyInParent = id;
    this.nodesMap = Object.create(null);
    this.parent = parent;
    this.refs = [];
    this.shadow = Object.create(null);
    this.nodeCount = -1;

    if (this.data && this.data.hasOwnProperty('__rd__')) {
      this.refs = this.data.__rd__.refs;
      const refExist = this.getRefById(this.id);
      if (refExist) {
        // Sometimes an object is already reactive, but its parent is dead, meaning all references to it are lost
        // In such a case that parent con be replace with a live parent
        if (refExist.parent.isDead) {
          refExist.parent = parent;
        }

        this.fixHierarchy(id, refExist);
        return refExist;
      }

      this.refs.push(this);
    } else {
      this.refs.push(this);
      // data === null means that parent does not have this id
      if (this.data === null) {
        // if a property with same id already exist in the parent shadow, then return it instead of making a new one
        if (this.parent.shadow[id]) {
          return this.parent.shadow[id];
        }

        this.data = {};
        if (this.parent.data[id]) {
          new ReactiveData(id, this.parent.data[id], this.parent);
        } else {
          this.parent.makeReactiveObject(this.parent.data, id, true);
        }
      }

      if (!Object.isExtensible(this.data)) {
        return;
      }

      defProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      if (this.data instanceof Galaxy.Scope || this.data.__scope__) {
        this.addKeyToShadow = G.View.EMPTY_CALL;
      }

      if (this.data instanceof Galaxy.Scope) {
        this.walkOnScope(this.data);
      } else {
        this.walk(this.data);
      }
    }

    this.fixHierarchy(id, this);
  }

  ReactiveData.prototype = {
    get isDead() {
      return this.nodeCount === 0 && this.refs.length === 1 && this.refs[0] === this;
    },
    // If parent data is an array, then this would be an item inside the array
    // therefore its keyInParent should NOT be its index in the array but the
    // array's keyInParent. This way we redirect each item in the array to the
    // array's reactive data
    fixHierarchy: function (id, reference) {
      if (this.parent.data instanceof Array) {
        this.keyInParent = this.parent.keyInParent;
      } else {
        this.parent.shadow[id] = reference;
      }
    },
    setData: function (data) {
      this.removeMyRef();

      if (!(data instanceof Object)) {
        this.data = {};

        for (let key in this.shadow) {
          // Cascade changes down to all children reactive data
          if (this.shadow[key] instanceof ReactiveData) {
            this.shadow[key].setData(data);
          } else {
            // changes should only propagate downward
            this.notifyDown(key);
          }
        }

        return;
      }

      this.data = data;
      if (data.hasOwnProperty('__rd__')) {
        this.data.__rd__.addRef(this);
        this.refs = this.data.__rd__.refs;

        if (this.data instanceof Array) {
          this.sync('length', this.data.length, false, false);
          this.sync('changes', this.data.changes, false, false);
        } else {
          this.syncAll();
        }
      } else {
        defProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: this
        });

        this.walk(this.data);
      }

      this.setupShadowProperties(getKeys(this.data));
    },
    /**
     *
     * @param data
     */
    walk: function (data) {
      if (data instanceof Node) return;

      if (data instanceof Array) {
        this.makeReactiveArray(data);
      } else if (data instanceof Object) {
        for (let key in data) {
          this.makeReactiveObject(data, key, false);
        }
      }
    },

    walkOnScope: function (scope) {
      // this.makeReactiveObject(scope, 'data');
    },
    /**
     *
     * @param data
     * @param {string} key
     * @param shadow
     */
    makeReactiveObject: function (data, key, shadow) {
      let value = data[key];
      if (typeof value === 'function') {
        return;
      }

      const property = Object.getOwnPropertyDescriptor(data, key);
      const getter = property && property.get;
      const setter = property && property.set;

      defProp(data, key, {
        get: function () {
          return getter ? getter.call(data) : value;
        },
        set: function (val) {
          const thisRD = data.__rd__;
          setter && setter.call(data, val);
          if (value === val) {
            // If value is array, then sync should be called so nodes that are listening to array itself get updated
            if (val instanceof Array) {
              thisRD.sync(key, val, true, false);
            } else if (val instanceof Object) {
              thisRD.notifyDown(key);
            }

            return;
          }

          value = val;

          // This means that the property suppose to be an object and there is probably an active binds to it
          // the active bind could be in one of the ref, so we have to check all the ref shadows
          for (let i = 0, len = thisRD.refs.length; i < len; i++) {
            const ref = thisRD.refs[i];
            if (ref.shadow[key]) {
              ref.makeKeyEnum(key);
              // setData provide downward data flow
              ref.shadow[key].setData(val);
            }
          }

          thisRD.notify(key, value);
        },
        enumerable: !shadow,
        configurable: true
      });

      if (this.shadow[key]) {
        this.shadow[key].setData(value);
      } else {
        this.shadow[key] = null;
      }

      // Update the ui for this key
      // This is for when the makeReactive method has been called by setData
      this.sync(key, value, false, false);
    },
    /**
     *
     * @param arr
     * @returns {*}
     */
    makeReactiveArray: function (arr) {
      if (arr.hasOwnProperty('changes')) {
        return arr.changes.init;
      }

      const _this = this;
      const initialChanges = new G.View.ArrayChange();
      initialChanges.original = arr;
      initialChanges.type = 'reset';
      initialChanges.params = arr;
      for (let i = 0, len = initialChanges.params.length; i < len; i++) {
        const item = initialChanges.params[i];
        if (item !== null && typeof item === 'object') {
          new ReactiveData(initialChanges.original.indexOf(item), item, _this);
        }
      }

      _this.sync('length', arr.length, false, false);
      initialChanges.init = initialChanges;
      defProp(arr, 'changes', {
        enumerable: false,
        configurable: false,
        writable: true,
        value: initialChanges
      });

      // We override all the array methods which mutate the array
      ARRAY_MUTATOR_METHODS.forEach(function (method) {
        defProp(arr, method, {
          value: create_array_value(arr, method, initialChanges),
          writable: false,
          configurable: true
        });
      });

      return initialChanges;
    },
    /**
     *
     * @param {string} key
     * @param {any} value
     * @param refs
     * @param {boolean} fromChild
     */
    notify: function (key, value, refs, fromChild) {
      if (this.refs === refs) {
        this.sync(key, value, false, fromChild);
        return;
      }

      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs, fromChild);
      }

      this.sync(key, value, false, fromChild);
      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        const keyInParent = ref.keyInParent;
        const refParent = ref.parent;
        ref.parent.notify(keyInParent, refParent.data[keyInParent], null, true);
      }
    },

    notifyDown: function (key) {
      const value = this.data[key];
      this.notifyRefs(key, value);
      this.sync(key, value, false, false);
    },

    notifyRefs: function (key, value) {
      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs);
      }
    },
    /**
     *
     * @param {string} propertyKey
     * @param {*} value
     * @param {boolean} sameValueObject
     * @param {boolean} fromChild
     */
    sync: function (propertyKey, value, sameValueObject, fromChild) {
      const _this = this;
      const map = _this.nodesMap[propertyKey];
      // notify the observers on the data
      G.Observer.notify(_this.data, propertyKey, value);

      if (map) {
        for (let i = 0, len = map.nodes.length; i < len; i++) {
          _this.syncNode(map.types[i], map.nodes[i], map.keys[i], value, sameValueObject, fromChild);
        }
      }
    },
    /**
     *
     */
    syncAll: function () {
      const _this = this;
      const keys = objKeys(_this.data);
      for (let i = 0, len = keys.length; i < len; i++) {
        _this.sync(keys[i], _this.data[keys[i]], false, false);
      }
    },
    /**
     *
     * @param {string} bindType
     * @param node
     * @param {string} key
     * @param {*} value
     * @param {boolean} sameObjectValue
     * @param {boolean} fromChild
     */
    syncNode: function (bindType, node, key, value, sameObjectValue, fromChild) {
      SYNC_NODE[bindType].call(null, node, key, value, sameObjectValue, fromChild);
    },
    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     */
    addRef: function (reactiveData) {
      if (this.refs.indexOf(reactiveData) === -1) {
        this.refs.push(reactiveData);
      }
    },
    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     */
    removeRef: function (reactiveData) {
      const index = this.refs.indexOf(reactiveData);
      if (index !== -1) {
        this.refs.splice(index, 1);
      }
    },
    /**
     *
     */
    removeMyRef: function () {
      if (!this.data || !this.data.hasOwnProperty('__rd__')) return;
      // if I am not the original reference, then remove me from the refs
      if (this.data.__rd__ !== this) {
        this.refs = [this];
        this.data.__rd__.removeRef(this);
      }
      // if I am the original reference and the only one, then remove the __rd__ and reactive functionalities
      else if (this.refs.length === 1) {
        const _data = this.data;
        if (_data instanceof Array) {
          for (const method of KEYS_TO_REMOVE_FOR_ARRAY) {
            Reflect.deleteProperty(_data, method);
          }
        }
        // This cause an issue since the properties are still reactive
        // else if (_data instanceof Object) {
        //   Reflect.deleteProperty(_data, '__rd__');
        // }
        // TODO: Should be tested as much as possible to make sure it works with no bug
        // TODO: We either need to return the object to its original state or do nothing
      }
      // if I am the original reference and not the only one
      else {
        this.data.__rd__.removeRef(this);
        const nextOwner = this.refs[0];
        defProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: nextOwner
        });

        this.refs = [this];
      }

    },
    /**
     *
     * @param {string} id
     * @returns {*}
     */
    getRefById: function (id) {
      return this.refs.filter(function (ref) {
        return ref.id === id;
      })[0];
    },
    /**
     *
     * @param {Galaxy.View.ViewNode} node
     * @param {string} nodeKey
     * @param {string} dataKey
     * @param {string} bindType
     * @param expression
     */
    addNode: function (node, nodeKey, dataKey, bindType, expression) {
      let map = this.nodesMap[dataKey];
      if (!map) {
        map = this.nodesMap[dataKey] = new NodeMap();
      }

      bindType = bindType || '_';

      if (this.nodeCount === -1) this.nodeCount = 0;

      const index = map.nodes.indexOf(node);
      // Check if the node with the same property already exist
      // Ensure that same node with different property bind can exist
      if (index === -1 || map.keys[index] !== nodeKey) {
        this.nodeCount++;
        if (node instanceof G.View.ViewNode && !node.setters[nodeKey]) {
          node.registerActiveProperty(nodeKey, this, expression);
        }

        map.push(nodeKey, node, bindType);

        // map.keys.push(nodeKey);
        // map.nodes.push(node);
        // map.types.push(bindType);

        let initValue = this.data[dataKey];
        // if the value is an instance of Array, then we should set its change property to its initial state
        if (initValue instanceof Array && initValue.changes) {
          if (initValue.hasOwnProperty('changes')) {
            initValue.changes = initValue.changes.init;
          } else {
            defProp(initValue, 'changes', {
              enumerable: false,
              configurable: false,
              writable: true,
              value: initValue.changes.init
            });
          }
        }

        // if initValue is a change object, then we have to use its init for nodes that are newly being added
        // if the dataKey is length then ignore this line and use initValue which represent the length of array
        if (this.data instanceof Array && dataKey !== 'length' && initValue) {
          initValue = initValue.init;
        }

        this.syncNode('_', node, nodeKey, initValue, false, false);
      }
    },
    /**
     *
     * @param node
     */
    removeNode: function (node) {
      for (let i = 0, len = this.refs.length; i < len; i++) {
        this.removeNodeFromRef(this.refs[i], node);
      }
    },
    /**
     *
     * @param ref
     * @param node
     */
    removeNodeFromRef: function (ref, node) {
      let map;
      for (let key in ref.nodesMap) {
        map = ref.nodesMap[key];

        let index = -1;
        while ((index = map.nodes.indexOf(node)) !== -1) {
          map.nodes.splice(index, 1);
          map.keys.splice(index, 1);
          map.types.splice(index, 1);
          this.nodeCount--;
        }
      }
    },
    /**
     *
     * @param {string} key
     * @param {boolean} isArray
     */
    addKeyToShadow: function (key, isArray) {
      // Don't empty the shadow object if it exists
      if (!(key in this.shadow)) {
        if (isArray) {
          this.shadow[key] = new ReactiveData(key, [], this);
        } else {
          this.shadow[key] = null;
        }
      }

      if (!this.data.hasOwnProperty(key)) {
        this.makeReactiveObject(this.data, key, false);
      }
    },
    /**
     *
     */
    setupShadowProperties: function (keys) {
      for (let key in this.shadow) {
        // Only reactive properties should be added to data
        if (this.shadow[key] instanceof ReactiveData) {
          if (!this.data.hasOwnProperty(key)) {
            this.makeReactiveObject(this.data, key, true);
          }
          this.shadow[key].setData(this.data[key]);
        } else if (keys.indexOf(key) === -1) {
          // This will make sure that UI is updated properly
          // for properties that has been removed from data
          this.sync(key, undefined, false, false);
        }
      }
    },
    /**
     *
     * @param {string} key
     */
    makeKeyEnum: function (key) {
      const desc = Object.getOwnPropertyDescriptor(this.data, key);
      if (desc && desc.enumerable === false) {
        desc.enumerable = true;
        defProp(this.data, key, desc);
      }
    }
  };

  return ReactiveData;

})(Galaxy);

/* global Galaxy, Promise */
Galaxy.View.ViewNode = /** @class */ (function (G) {
  const GV = G.View;
  const commentNode = document.createComment('');
  const defProp = Object.defineProperty;
  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;
  const create_in_next_frame = G.View.create_in_next_frame;
  const destroy_in_next_frame = G.View.destroy_in_next_frame;

  function create_comment(t) {
    const n = commentNode.cloneNode();
    n.textContent = t;
    return n;
  }

  /**
   *
   * @param {string} tagName
   * @param {Galaxy.View.ViewNode} parentViewNode
   * @returns {HTMLElement|Comment}
   */
  function create_elem(tagName, parentViewNode) {
    if (tagName === 'svg' || (parentViewNode && parentViewNode.blueprint.tag === 'svg')) {
      return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    if (tagName === 'comment') {
      return document.createComment('ViewNode');
    }

    return document.createElement(tagName);
  }

  function insert_before(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  }

  function remove_child(node, child) {
    node.removeChild(child);
  }

  const referenceToThis = {
    value: this,
    configurable: false,
    enumerable: false
  };

  const __node__ = {
    value: null,
    configurable: false,
    enumerable: false,
    writable: true
  };

  const arrIndexOf = Array.prototype.indexOf;
  const arrSlice = Array.prototype.slice;

  //------------------------------

  GV.NODE_BLUEPRINT_PROPERTY_MAP['node'] = {
    type: 'none'
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_create'] = {
    type: 'prop',
    key: '_create',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_render'] = {
    type: 'prop',
    key: '_render',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['_destroy'] = {
    type: 'prop',
    key: '_destroy',
    getSetter: () => EMPTY_CALL
  };

  GV.NODE_BLUEPRINT_PROPERTY_MAP['renderConfig'] = {
    type: 'prop',
    key: 'renderConfig'
  };

  /**
   *
   * @typedef {Object} RenderConfig
   * @property {boolean} [applyClassListAfterRender] - Indicates whether classlist applies after the render.
   * @property {boolean} [renderDetached] - Make the node to be rendered in a detached mode.
   */

  /**
   * @typedef {Object} Blueprint
   * @memberOf Galaxy
   * @property {RenderConfig} [renderConfig]
   * @property {string} [tag]
   * @property {function} [_create]
   * @property {function} [_render]
   * @property {function} [_destroy]
   */

  /**
   *
   * @type {RenderConfig}
   */
  ViewNode.GLOBAL_RENDER_CONFIG = {
    applyClassListAfterRender: false,
    renderDetached: false
  };

  /**
   *
   * @param blueprints
   * @memberOf Galaxy.View.ViewNode
   * @static
   */
  ViewNode.cleanReferenceNode = function (blueprints) {
    if (blueprints instanceof Array) {
      blueprints.forEach(function (node) {
        ViewNode.cleanReferenceNode(node);
      });
    } else if (blueprints instanceof Object) {
      blueprints.node = null;
      ViewNode.cleanReferenceNode(blueprints.children);
    }
  };

  ViewNode.createIndex = function (i) {
    if (i < 0) return '0';
    if (i < 10) return i + '';

    let r = '9';
    let res = i - 10;
    while (res >= 10) {
      r += '9';
      res -= 10;
    }

    return r + res;
  };

  function REMOVE_SELF(destroy) {
    const viewNode = this;

    if (destroy) {
      // Destroy
      viewNode.node.parentNode && remove_child(viewNode.node.parentNode, viewNode.node);
      viewNode.placeholder.parentNode && remove_child(viewNode.placeholder.parentNode, viewNode.placeholder);
      viewNode.garbage.forEach(function (node) {
        REMOVE_SELF.call(node, true);
      });
      viewNode.hasBeenDestroyed();
    } else {
      // Detach
      if (!viewNode.placeholder.parentNode) {
        insert_before(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
      }

      if (viewNode.node.parentNode) {
        remove_child(viewNode.node.parentNode, viewNode.node);
      }

      viewNode.garbage.forEach(function (node) {
        REMOVE_SELF.call(node, true);
      });
    }

    viewNode.garbage = [];
  }

  /**
   *
   * @param {Blueprint} blueprint
   * @param {Galaxy.View.ViewNode} parent
   * @param {Galaxy.View} view
   * @param {any} nodeData
   * @constructor
   * @memberOf Galaxy.View
   */
  function ViewNode(blueprint, parent, view, nodeData) {
    const _this = this;
    _this.view = view;
    /** @type {Node|Element|*} */
    if (blueprint.tag instanceof Node) {
      _this.node = blueprint.tag;
      blueprint.tag = blueprint.tag.tagName;
      if (_this.node instanceof Text) {
        _this.processEnterAnimation = EMPTY_CALL;
      }
    } else {
      _this.node = create_elem(blueprint.tag || 'div', parent);
    }

    /**
     *
     * @type {Blueprint}
     */
    _this.blueprint = blueprint;
    _this.data = nodeData instanceof Galaxy.Scope ? {} : nodeData;
    _this.localPropertyNames = new Set();
    _this.inputs = {};
    _this.virtual = false;
    _this.visible = true;
    _this.placeholder = create_comment(blueprint.tag || 'div');
    _this.properties = new Set();
    _this.inDOM = false;
    _this.setters = {};
    /** @type {Galaxy.View.ViewNode} */
    _this.parent = parent;
    _this.finalize = [];
    _this.origin = false;
    _this.destroyOrigin = 0;
    _this.transitory = false;
    _this.garbage = [];
    _this.leaveWithParent = false;
    _this.onLeaveComplete = REMOVE_SELF.bind(_this, true);

    const cache = {};
    defProp(_this, 'cache', {
      enumerable: false,
      configurable: false,
      value: cache
    });

    _this.rendered = new Promise(function (done) {
      if ('style' in _this.node) {
        _this.hasBeenRendered = function () {
          _this.rendered.resolved = true;
          _this.node.style.removeProperty('display');
          if (_this.blueprint._render) {
            _this.blueprint._render.call(_this, _this.data);
          }
          done(_this);
        };
      } else {
        _this.hasBeenRendered = function () {
          _this.rendered.resolved = true;
          done();
        };
      }
    });
    _this.rendered.resolved = false;

    _this.destroyed = new Promise(function (done) {
      _this.hasBeenDestroyed = function () {
        _this.destroyed.resolved = true;
        if (_this.blueprint._destroy) {
          _this.blueprint._destroy.call(_this, _this.data);
        }
        done();
      };
    });
    _this.destroyed.resolved = false;

    /**
     *
     * @type {RenderConfig}
     */
    _this.blueprint.renderConfig = Object.assign({}, ViewNode.GLOBAL_RENDER_CONFIG, blueprint.renderConfig || {});

    __node__.value = this.node;
    defProp(_this.blueprint, 'node', __node__);

    referenceToThis.value = this;
    if (!_this.node.__vn__) {
      defProp(_this.node, '__vn__', referenceToThis);
      defProp(_this.placeholder, '__vn__', referenceToThis);
    }

    if (_this.blueprint._create) {
      _this.blueprint._create.call(_this, _this.data);
    }
  }

  ViewNode.prototype = {
    onLeaveComplete: null,

    dump: function () {
      let original = this.parent;
      let targetGarbage = this.garbage;
      // Find the garbage of the origin if
      while (original.transitory) {
        if (original.blueprint.hasOwnProperty('if') && !this.blueprint.hasOwnProperty('if')) {
          targetGarbage = original.garbage;
        }
        if (original.parent && original.parent.transitory) {
          original = original.parent;
        } else {
          break;
        }
      }
      targetGarbage.push(this);

      this.garbage = [];
    },
    query: function (selectors) {
      return this.node.querySelector(selectors);
    },

    dispatchEvent: function (event) {
      this.node.dispatchEvent(event);
    },

    cloneBlueprint: function () {
      const blueprintClone = Object.assign({}, this.blueprint);
      ViewNode.cleanReferenceNode(blueprintClone);

      defProp(blueprintClone, 'mother', {
        value: this.blueprint,
        writable: false,
        enumerable: false,
        configurable: false
      });

      return blueprintClone;
    },

    virtualize: function () {
      this.placeholder.nodeValue = JSON.stringify(this.blueprint, (k, v) => {
        return k === 'children' ? '<children>' : k === 'animations' ? '<animations>' : v;
      }, 2);
      this.virtual = true;
      this.setInDOM(false);
    },

    processEnterAnimation: function () {
      this.node.style.display = null;
    },

    processLeaveAnimation: EMPTY_CALL,

    populateHideSequence: function () {
      this.node.style.display = 'none';
    },

    /**
     *
     * @param {boolean} flag
     */
    setInDOM: function (flag) {
      const _this = this;
      if (_this.blueprint.renderConfig.renderDetached) {
        create_in_next_frame(_this.index, (_next) => {
          _this.blueprint.renderConfig.renderDetached = false;
          _this.hasBeenRendered();
          _next();
        });
        return;
      }

      _this.inDOM = flag;
      if (_this.virtual) return;

      if (flag) {
        if ('style' in _this.node) {
          _this.node.style.setProperty('display', 'none');
        }

        if (!_this.node.parentNode) {
          insert_before(_this.placeholder.parentNode, _this.node, _this.placeholder.nextSibling);
        }

        if (_this.placeholder.parentNode) {
          remove_child(_this.placeholder.parentNode, _this.placeholder);
        }

        create_in_next_frame(_this.index, (_next) => {
          _this.hasBeenRendered();
          _this.processEnterAnimation();
          _next();
        });

        const children = _this.getChildNodesAsc();
        const len = children.length;
        for (let i = 0; i < len; i++) {
          // console.log(children[i].node);
          children[i].setInDOM(true);
        }
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        const defaultProcessLeaveAnimation = _this.processLeaveAnimation;
        const children = _this.getChildNodes();
        _this.prepareLeaveAnimation(_this.hasAnimation(children), children);
        destroy_in_next_frame(_this.index, (_next) => {
          _this.processLeaveAnimation(REMOVE_SELF.bind(_this, false));
          _this.origin = false;
          _this.transitory = false;
          _this.processLeaveAnimation = defaultProcessLeaveAnimation;
          _next();
        });
      }
    },

    setVisibility: function (flag) {
      const _this = this;
      _this.visible = flag;

      if (flag && !_this.virtual) {
        create_in_next_frame(_this.index, (_next) => {
          _this.node.style.display = null;
          _this.processEnterAnimation();
          _next();
        });
      } else if (!flag && _this.node.parentNode) {
        _this.origin = true;
        _this.transitory = true;
        destroy_in_next_frame(_this.index, (_next) => {
          _this.populateHideSequence();
          _this.origin = false;
          _this.transitory = false;
          _next();
        });
      }
    },

    /**
     *
     * @param {Galaxy.View.ViewNode} childNode
     * @param position
     */
    registerChild: function (childNode, position) {
      this.node.insertBefore(childNode.placeholder, position);
    },

    createNode: function (blueprint, localScope) {
      this.view.createNode(blueprint, localScope, this);
    },

    /**
     * @param {string} propertyKey
     * @param {Galaxy.View.ReactiveData} reactiveData
     * @param {Function} expression
     */
    registerActiveProperty: function (propertyKey, reactiveData, expression) {
      this.properties.add(reactiveData);
      GV.activate_property_for_node(this, propertyKey, reactiveData, expression);
    },

    snapshot: function (animations) {
      const rect = this.node.getBoundingClientRect();
      const node = this.node.cloneNode(true);
      const style = {
        margin: '0',
        width: rect.width + 'px',
        height: rect.height + ' px',
        top: rect.top + 'px',
        left: rect.left + 'px',
        position: 'fixed',
      };
      Object.assign(node.style, style);

      return {
        tag: node,
        style: style
      };
    },

    hasAnimation: function (children) {
      if (this.processLeaveAnimation && this.processLeaveAnimation !== EMPTY_CALL) {
        return true;
      }

      for (let i = 0, len = children.length; i < len; i++) {
        const node = children[i];
        if (node.hasAnimation(node.getChildNodes())) {
          return true;
        }
      }

      return false;
    },

    prepareLeaveAnimation: function (hasAnimation, children) {
      const _this = this;

      if (hasAnimation) {
        if (_this.processLeaveAnimation === EMPTY_CALL) {
          if (_this.origin) {
            _this.processLeaveAnimation = function () {
              REMOVE_SELF.call(_this, false);
            };
          }
          // if a child has an animation and this node is being removed directly, then we need to remove this node
          // in order for element to get removed properly
          else if (_this.destroyOrigin === 1) {
            REMOVE_SELF.call(_this, true);
          }
        } else if (_this.processLeaveAnimation !== EMPTY_CALL && !_this.origin) {
          // Children with leave animation should not get removed from dom for visual purposes.
          // Since their this node already has a leave animation and eventually will be removed from dom.
          // this is not the case for when this node is being detached by if
          // const children = _this.getChildNodes();
          for (let i = 0, len = children.length; i < len; i++) {
            children[i].onLeaveComplete = EMPTY_CALL;
          }
        }
      } else {
        _this.processLeaveAnimation = function () {
          REMOVE_SELF.call(_this, !_this.origin);
        };
      }
    },

    destroy: function (hasAnimation) {
      const _this = this;
      _this.transitory = true;
      if (_this.parent.destroyOrigin === 0) {
        // destroy() has been called on this node
        _this.destroyOrigin = 1;
      } else {
        // destroy() has been called on a parent node
        _this.destroyOrigin = 2;
      }

      if (_this.inDOM) {
        const children = _this.getChildNodes();
        hasAnimation = hasAnimation || _this.hasAnimation(children);
        _this.prepareLeaveAnimation(hasAnimation, children);
        _this.clean(hasAnimation, children);
      }

      _this.properties.forEach((reactiveData) => reactiveData.removeNode(_this));
      let len = _this.finalize.length;
      for (let i = 0; i < len; i++) {
        _this.finalize[i].call(_this);
      }

      destroy_in_next_frame(_this.index, (_next) => {
        _this.processLeaveAnimation(_this.destroyOrigin === 2 ? EMPTY_CALL : _this.onLeaveComplete);
        _this.localPropertyNames.clear();
        _this.properties.clear();
        _this.finalize = [];
        _this.inDOM = false;
        _this.inputs = {};
        _this.view = null;
        _this.parent = null;
        Reflect.deleteProperty(_this.blueprint, 'node');
        _next();
      });
    },

    getChildNodes: function () {
      const nodes = [];
      const cn = arrSlice.call(this.node.childNodes, 0);
      for (let i = cn.length - 1; i >= 0; i--) {
        // All the nodes that are ViewNode
        const node = cn[i];
        if ('__vn__' in node) {
          nodes.push(node['__vn__']);
        }
      }

      return nodes;
    },

    getChildNodesAsc: function () {
      const nodes = [];
      const cn = arrSlice.call(this.node.childNodes, 0);
      for (let i = 0; i < cn.length; i++) {
        // All the nodes that are ViewNode
        const node = cn[i];
        if ('__vn__' in node) {
          nodes.push(node['__vn__']);
        }
      }

      return nodes;
    },

    /**
     *
     */
    clean: function (hasAnimation, children) {
      children = children || this.getChildNodes();
      GV.destroy_nodes(children, hasAnimation);

      destroy_in_next_frame(this.index, (_next) => {
        let len = this.finalize.length;
        for (let i = 0; i < len; i++) {
          this.finalize[i].call(this);
        }
        this.finalize = [];
        _next();
      });
    },

    createNext: function (act) {
      create_in_next_frame(this.index, act);
    },

    get index() {
      const parent = this.parent;

      // This solution is very performant but might not be reliable
      if (parent) {
        let prevNode = this.placeholder.parentNode ? this.placeholder.previousSibling : this.node.previousSibling;
        if (prevNode) {
          if (!prevNode.hasOwnProperty('__index__')) {
            let i = 0;
            let node = this.node;
            while ((node = node.previousSibling) !== null) ++i;
            prevNode.__index__ = i;
          }
          this.node.__index__ = prevNode.__index__ + 1;
        } else {
          this.node.__index__ = 0;
        }

        return parent.index + ',' + ViewNode.createIndex(this.node.__index__);
      }

      return '0';
    },

    get anchor() {
      if (this.inDOM) {
        return this.node;
      }

      return this.placeholder;
    }
  };

  return ViewNode;

})(Galaxy);

/* global Galaxy, gsap */
(function (G) {
  if (!window.gsap) {
    G.setupTimeline = function () {};
    G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
      type: 'prop',
      key: 'animations',
      /**
       *
       * @param {Galaxy.View.ViewNode} viewNode
       * @param animationDescriptions
       */
      update: function (viewNode, animationDescriptions) {
        if (animationDescriptions.enter && animationDescriptions.enter.to.onComplete) {
          viewNode.processEnterAnimation = animationDescriptions.enter.to.onComplete;
        }
        viewNode.processLeaveAnimation = (onComplete) => {
          onComplete();
        };
      }
    };

    window.gsap = {
      to: function (node, props) {
        return requestAnimationFrame(() => {
          if (typeof node === 'string') {
            node = document.querySelector(node);
          }

          const style = node.style;
          if (style) {
            const keys = Object.keys(props);
            for (let i = 0, len = keys.length; i < len; i++) {
              const key = keys[i];
              const value = props[key];
              switch (key) {
                case 'duration':
                case 'ease':
                  break;

                case 'opacity':
                case 'z-index':
                  style.setProperty(key, value);
                  break;

                case 'scrollTo':
                  node.scrollTop = typeof value.y === 'string' ? document.querySelector(value.y).offsetTop : value.y;
                  node.scrollLeft = typeof value.x === 'string' ? document.querySelector(value.x).offsetLeft : value.x;
                  break;

                default:
                  style.setProperty(key, typeof value === 'number' && value !== 0 ? value + 'px' : value);
              }
            }
          } else {
            Object.assign(node, props);
          }
        });
      },
    };

    console.info('%cIn order to activate animations, load GSAP - GreenSock', 'color: yellowgreen; font-weight: bold;');
    console.info('%cYou can implement most common animations by loading the following resources before galaxy.js', 'color: yellowgreen;');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/gsap.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/ScrollToPlugin.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/EasePack.min.js\n\n');
    return;
  }

  function has_parent_enter_animation(viewNode) {
    if (!viewNode.parent) return false;

    const parent = viewNode.parent;
    if (parent.blueprint.animations && parent.blueprint.animations.enter && gsap.getTweensOf(parent.node).length) {
      return true;
    }

    return has_parent_enter_animation(viewNode.parent);
  }

  const document_body = document.body;

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
    type: 'prop',
    key: 'animations',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param animations
     */
    update: function (viewNode, animations) {
      if (viewNode.virtual || !animations) {
        return;
      }

      const enter = animations.enter;
      if (enter) {
        viewNode.processEnterAnimation = function () {
          process_enter_animation(this, enter);
        };
      }

      const leave = animations.leave;
      if (leave) {
        // We need an empty enter animation in order to have a proper behavior for if
        if (!enter && viewNode.blueprint.if) {
          console.warn('The following node has `if` and a `leave` animation but does NOT have a `enter` animation.' +
            '\nThis can result in unexpected UI behavior.\nTry to define a `enter` animation that negates the leave animation to prevent unexpected behavior\n\n');
          console.warn(viewNode.node);
        }

        viewNode.processLeaveAnimation = function (finalize) {
          process_leave_animation(this, leave, finalize);
        };

        // Hide timeline is the same as leave timeline.
        // The only difference is that hide timeline will add `display: 'none'` to the node at the end
        viewNode.populateHideSequence = viewNode.processLeaveAnimation.bind(viewNode, () => {
          viewNode.node.style.display = 'none';
        });
      } else {
        // By default, imitate leave with parent behavior
        viewNode.processLeaveAnimation = leave_with_parent.bind(viewNode);
      }

      const viewNodeCache = viewNode.cache;
      if (viewNodeCache.class && viewNodeCache.class.observer) {
        viewNode.rendered.then(function () {
          const classes = viewNodeCache.class.observer.context;

          // Apply final state for class animations
          for (const key in classes) {
            const type = Boolean(classes[key]);
            const animationConfig = get_class_based_animation_config(animations, type, key);
            if (animationConfig) {
              if (animationConfig.to.keyframes instanceof Array) {
                for (let i = 0, len = animationConfig.to.keyframes.length; i < len; i++) {
                  gsap.set(viewNode.node, Object.assign({ callbackScope: viewNode }, animationConfig.to.keyframes[i] || {}));
                }
              } else {
                gsap.set(viewNode.node, Object.assign({ callbackScope: viewNode }, animationConfig.to || {}));
              }

              if (type) {
                viewNode.node.classList.add(key);
              } else {
                viewNode.node.classList.remove(key);
              }
            }
          }

          let oldHash = JSON.stringify(classes);
          viewNodeCache.class.observer.onAll((className) => {
            const newHash = JSON.stringify(classes);
            if (oldHash === newHash) {
              return;
            }

            oldHash = newHash;
            const addOrRemove = Boolean(classes[className]);
            const animationConfig = get_class_based_animation_config(animations, addOrRemove, className);

            if (animationConfig) {
              const tweenKey = 'tween:' + className;
              if (viewNodeCache[tweenKey]) {
                viewNodeCache[tweenKey].forEach(t => t.kill());
                Reflect.deleteProperty(viewNodeCache, tweenKey);
              }

              // if(!viewNode.rendered.resolved) {
              //   console.log(viewNode.node)
              // }

              process_class_animation(viewNode, viewNodeCache, tweenKey, animationConfig, addOrRemove, className);
            }
          });
        });
      }
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {AnimationConfig} animationConfig
   * @returns {*}
   */
  function process_enter_animation(viewNode, animationConfig) {
    const _node = viewNode.node;
    if (animationConfig.withParent) {
      // if parent has an enter animation, then ignore viewNode's animation
      // so viewNode can enter with its parent
      if (has_parent_enter_animation(viewNode)) {
        return gsap.set(_node, Object.assign({}, animationConfig.to || {}));
      }

      const parent = viewNode.parent;
      // if enter.withParent flag is there, then only apply animation to the nodes are rendered
      if (!parent.rendered.resolved) {
        return;
      }
    }

    if (gsap.getTweensOf(_node).length) {
      gsap.killTweensOf(_node);
    }

    // if a parent node is rendered detached, then this node won't be in the DOM
    // therefore, their animations should be ignored.
    if (!document_body.contains(_node)) {
      // console.log(_node);
      // if the node is not part of the DOM/body then probably it's being rendered detached,
      // and we should skip its enter animation
      return;
    }

    AnimationMeta.installGSAPAnimation(viewNode, 'enter', animationConfig);
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {AnimationConfig} animationConfig
   * @param {Function} [finalize]
   */
  function process_leave_animation(viewNode, animationConfig, finalize) {
    const active = animationConfig.active;
    if (active === false) {
      return leave_with_parent.call(viewNode, finalize);
    }

    const withParentResult = animationConfig.withParent;
    viewNode.leaveWithParent = withParentResult === true;
    const _node = viewNode.node;
    // if (gsap.getTweensOf(_node).length) {
    //   gsap.killTweensOf(_node);
    // }

    if (withParentResult) {
      // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
      const parent = viewNode.parent;
      if (parent.transitory) {
        gsap.killTweensOf(_node);
        // We dump _node, so it gets removed when the leave's animation's origin node is detached.
        // This fixes a bug where removed elements stay in DOM if the cause of the leave animation is a 'if'
        return viewNode.dump();
      }
    }

    // in the case which the _viewNode is not visible, then ignore its animation
    const rect = _node.getBoundingClientRect();
    if (rect.width === 0 ||
      rect.height === 0 ||
      _node.style.opacity === '0' ||
      _node.style.visibility === 'hidden') {
      gsap.killTweensOf(_node);
      return finalize();
    }

    const tweens = gsap.getTweensOf(_node);
    for (const t of tweens) {
      if (t.parent) {
        t.parent.pause();
        t.parent.remove(t);
      } else {
        t.pause();
      }
    }

    AnimationMeta.installGSAPAnimation(viewNode, 'leave', animationConfig, finalize);
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {Object} viewNodeCache
   * @param {string} tweenKey
   * @param {AnimationConfig} animationConfig
   * @param {boolean} addOrRemove
   * @param {string} className
   */
  function process_class_animation(viewNode, viewNodeCache, tweenKey, animationConfig, addOrRemove, className) {
    const IN_NEXT_FRAME = addOrRemove ? G.View.create_in_next_frame : G.View.destroy_in_next_frame;
    IN_NEXT_FRAME(viewNode.index, (_next) => {
      const tweenExist = Boolean(viewNodeCache[tweenKey]);

      if (addOrRemove && (!viewNode.node.classList.contains(className) || tweenExist)) {
        AnimationMeta.setupOnComplete(animationConfig, () => {
          viewNode.node.classList.add(className);
        });
      } else if (!addOrRemove && (viewNode.node.classList.contains(className) || tweenExist)) {
        AnimationMeta.setupOnComplete(animationConfig, () => {
          viewNode.node.classList.remove(className);
        });
      }

      viewNodeCache[tweenKey] = viewNodeCache[tweenKey] || [];
      viewNodeCache[tweenKey].push(AnimationMeta.installGSAPAnimation(viewNode, null, animationConfig));
      _next();
    });
  }

  /**
   *
   * @param {*} animations
   * @param {boolean} type
   * @param {string} key
   * @returns {*}
   */
  function get_class_based_animation_config(animations, type, key) {
    const animationKey = type ? 'add:' + key : 'remove:' + key;
    return animations[animationKey];
  }

  function leave_with_parent(finalize) {
    // if (gsap.getTweensOf(this.node).length) {
    //   gsap.killTweensOf(this.node);
    // }
    const tweens = gsap.getTweensOf(this.node);
    for (const t of tweens) {
      if (t.parent) {
        // t.pause();
        t.parent.pause();
        t.parent.remove(t);
      } else {
        t.pause();
      }
    }

    if (this.parent.transitory) {
      this.dump();
    } else {
      finalize();
    }
  }

  G.View.AnimationMeta = AnimationMeta;

  /**
   *
   * @typedef {Object} AnimationConfig
   * @property {boolean} [withParent]
   * @property {string} [timeline]
   * @property {string[]} [labels]
   * @property {Promise} [await]
   * @property {string|number} [startPosition]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {object} [from]
   * @property {object} [to]
   * @property {string} [addTo]
   * @property {Function} [onStart]
   * @property {Function} [onComplete]
   */

  AnimationMeta.ANIMATIONS = {};
  AnimationMeta.TIMELINES = {};

  AnimationMeta.createSimpleAnimation = function (viewNode, config, finalize) {
    finalize = finalize || G.View.EMPTY_CALL;
    const node = viewNode.node;
    let from = config.from;
    let to = config.to;

    if (to) {
      to = Object.assign({}, to);
      to.onComplete = finalize;

      if (config.onComplete) {
        const userDefinedOnComplete = config.onComplete;
        to.onComplete = function () {
          userDefinedOnComplete();
          finalize();
        };
      }
    }

    let tween;
    if (from && to) {
      tween = gsap.fromTo(node, from, to);
    } else if (from) {
      from = Object.assign({}, from);
      from.onComplete = finalize;

      if (config.onComplete) {
        const userDefinedOnComplete = config.onComplete;
        from.onComplete = function () {
          userDefinedOnComplete();
          finalize();
        };
      }

      tween = gsap.from(node, from);
    } else if (to) {
      tween = gsap.to(node, to);
    } else if (config.onComplete) {
      const userDefinedOnComplete = config.onComplete;
      const onComplete = function () {
        userDefinedOnComplete();
        finalize();
      };

      tween = gsap.to(node, {
        duration: config.duration || 0,
        onComplete: onComplete
      });
    } else {

      tween = gsap.to(node, {
        duration: config.duration || 0,
        onComplete: finalize
      });
    }

    return tween;
  };

  /**
   *
   * @param stepDescription
   * @param onStart
   * @param onComplete
   * @param viewNode
   * @return {*}
   */
  AnimationMeta.addCallbackScope = function (stepDescription, viewNode) {
    const step = Object.assign({}, stepDescription);
    step.callbackScope = viewNode;

    return step;
  };

  AnimationMeta.setupOnComplete = function (description, onComplete) {
    if (description.onComplete) {
      const userDefinedOnComplete = description.onComplete;
      description.onComplete = function () {
        userDefinedOnComplete();
        onComplete();
      };
    } else {
      description.onComplete = () => {
        onComplete();
      };
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|null} type
   * @param {AnimationConfig} descriptions
   * @param {Function} [finalize]
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, finalize) {
    const from = descriptions.from;
    let to = descriptions.to;

    if (type !== 'leave' && to && viewNode.node.nodeType !== Node.COMMENT_NODE) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    }

    // if (type.indexOf('add:') === 0 || type.indexOf('remove:') === 0) {
    //   to = Object.assign(to || {}, { overwrite: 'none' });
    // }
    /** @type {AnimationConfig} */
    const newConfig = Object.assign({}, descriptions);
    newConfig.from = from;
    newConfig.to = to;
    let timelineName = newConfig.timeline;

    let parentAnimationMeta = null;
    if (timelineName) {
      const animationMeta = new AnimationMeta(timelineName);
      // Class animation do not have a type since their `enter` and `leave` states are not the same a
      // node's `enter` and `leave`. A class can be added or in other word, have an `enter` state while its timeline
      // is in a `leave` state or vice versa.
      type = type || animationMeta.type;
      // By calling 'addTo' first, we can provide a parent for the 'animationMeta.timeline'
      // if (newConfig.addTo) {
      //   parentAnimationMeta = new AnimationMeta(newConfig.addTo);
      //   const children = parentAnimationMeta.timeline.getChildren(false);
      //   if (children.indexOf(animationMeta.timeline) === -1) {
      //     parentAnimationMeta.timeline.add(animationMeta.timeline, parentAnimationMeta.parsePosition(newConfig.positionInParent));
      //   }
      // }

      // Make sure the await step is added to highest parent as long as that parent is not the 'gsap.globalTimeline'
      if (newConfig.await && animationMeta.awaits.indexOf(newConfig.await) === -1) {
        let parentTimeline = animationMeta.timeline;
        // console.log(parentTimeline.getChildren(false));
        while (parentTimeline.parent !== gsap.globalTimeline) {
          if (!parentTimeline.parent) return;
          parentTimeline = parentTimeline.parent;
        }

        animationMeta.awaits.push(newConfig.await);

        // The pauseTween will be removed from the parentTimeline by GSAP the moment the pause is hit
        const pauseTween = parentTimeline.addPause(newConfig.position, () => {
          if (viewNode.transitory || viewNode.destroyed.resolved) {
            return parentTimeline.resume();
          }

          newConfig.await.then(removeAwait);
        }).recent();

        const removeAwait = ((_pause) => {
          const index = animationMeta.awaits.indexOf(newConfig.await);
          if (index !== -1) {
            animationMeta.awaits.splice(index, 1);
            // Do not remove the pause if it is already executed
            if (_pause._initted) {
              parentTimeline.resume();
            } else {
              const children = parentTimeline.getChildren(false);
              if (children.indexOf(_pause) !== -1) {
                parentTimeline.remove(_pause);
              }
            }
          }
        }).bind(null, pauseTween);
        // We don't want the animation wait for await, if this `viewNode` is destroyed before await gets a chance
        // to be resolved. Therefore, we need to remove await.
        viewNode.finalize.push(() => {
          // if the element is removed before await is resolved, then make sure the element stays hidden
          if (animationMeta.awaits.indexOf(newConfig.await) !== -1 && viewNode.node.style) {
            viewNode.node.style.display = 'none';
          }
          removeAwait();
        });
      }

      // The first tween of an animation type(enter or leave) should use startPosition
      if (animationMeta.type && animationMeta.type !== type && !newConfig.keyframe && (newConfig.position && newConfig.position.indexOf('=') !== -1)) {
        // newConfig.position = newConfig.startPosition;
      }

      const children = animationMeta.timeline.getChildren(false);
      if (children.length) {
        const lastTween = children[children.length - 1];
        if (lastTween.data === 'timeline:start') {
          newConfig.position = '+=0';
        }
      }

      animationMeta.type = type;
      // console.log(newConfig)
      const tween = animationMeta.add(viewNode, newConfig, finalize);

      // In the case where the addToAnimationMeta.timeline has no child then animationMeta.timeline would be
      // its only child and, we have to resume it if it's not playing
      if (newConfig.addTo && parentAnimationMeta) {
        if (!parentAnimationMeta.started /*&& parentAnimationMeta.name !== '<user-defined>'*/) {
          parentAnimationMeta.started = true;
          parentAnimationMeta.timeline.resume();
        }
      }

      return tween;
    } else {
      return AnimationMeta.createSimpleAnimation(viewNode, newConfig, finalize);
    }
  };

  const TIMELINE_SETUP_MAP = {};
  G.setupTimeline = function (name, labels) {
    TIMELINE_SETUP_MAP[name] = labels;
    const animationMeta = AnimationMeta.ANIMATIONS[name];
    if (animationMeta) {
      animationMeta.setupLabels(labels);
    }
  };
  Galaxy.TIMELINE_SETUP_MAP = TIMELINE_SETUP_MAP;

  /**
   *
   * @param {string} name
   * @class
   */
  function AnimationMeta(name) {
    const _this = this;
    if (name && typeof name !== 'string') {
      if (name.__am__) {
        return name.__am__;
      }

      const onComplete = name.eventCallback('onComplete') || Galaxy.View.EMPTY_CALL;

      _this.name = '<user-defined>';
      _this.timeline = name;
      _this.timeline.__am__ = this;
      _this.timeline.eventCallback('onComplete', function () {
        onComplete.call(_this.timeline);
        _this.onCompletesActions.forEach((action) => {
          action(_this.timeline);
        });
        _this.nodes = [];
        _this.awaits = [];
        _this.children = [];
        _this.onCompletesActions = [];
      });
      _this.parsePosition = (p) => p;
    } else {
      const exist = AnimationMeta.ANIMATIONS[name];
      if (exist) {
        if (!exist.timeline.getChildren().length && !exist.timeline.isActive()) {
          exist.timeline.clear(false);
          exist.timeline.invalidate();
        }
        return exist;
      }

      _this.name = name;
      _this.timeline = gsap.timeline({
        autoRemoveChildren: true,
        smoothChildTiming: false,
        paused: true,
        onComplete: function () {
          _this.onCompletesActions.forEach((action) => {
            action(_this.timeline);
          });
          _this.nodes = [];
          _this.awaits = [];
          _this.children = [];
          _this.onCompletesActions = [];
          AnimationMeta.ANIMATIONS[name] = null;
        }
      });
      _this.timeline.data = { name };
      _this.labelCounter = 0;
      _this.labelsMap = {};

      const labels = TIMELINE_SETUP_MAP[name];
      if (labels) {
        _this.setupLabels(labels);
      }

      AnimationMeta.ANIMATIONS[name] = this;
    }

    _this.type = null;
    _this.onCompletesActions = [];
    _this.started = false;
    _this.configs = {};
    _this.children = [];
    _this.nodes = [];
    _this.awaits = [];
  }

  AnimationMeta.prototype = {
    setupLabels: function (labels) {
      for (const label in labels) {
        const newLabel = 'label_' + this.labelCounter++;
        const position = labels[label];
        this.labelsMap[label] = newLabel;
        this.timeline.addLabel(newLabel, typeof position === 'number' ? '+=' + position : position);
      }
    },
    parsePosition: function (p) {
      let position = this.labelsMap[p] || p;
      let label = null;
      if (position || typeof position === 'number') {
        if (position.indexOf('+=') !== -1) {
          const parts = position.split('+=');
          label = parts[0];
        } else if (position.indexOf('-=') !== -1) {
          const parts = position.split('-=');
          label = parts[0];
        }
      }

      if (label && label !== '<' && label !== '>') {
        position = position.replace(label, this.labelsMap[label]);
      }
      return position;
    },
    addOnComplete: function (action) {
      this.onCompletesActions.push(action);
    },

    /**
     *
     * @param viewNode
     * @param config {AnimationConfig}
     * @param finalize
     */
    add: function (viewNode, config, finalize) {
      const _this = this;
      let tween = null;

      if (config.from && config.to) {
        const to = AnimationMeta.addCallbackScope(config.to, viewNode);
        tween = gsap.fromTo(viewNode.node, config.from, to);
      } else if (config.from) {
        const from = AnimationMeta.addCallbackScope(config.from, viewNode);
        tween = gsap.from(viewNode.node, from);
      } else {
        const to = AnimationMeta.addCallbackScope(config.to, viewNode);
        tween = gsap.to(viewNode.node, to);
      }

      if (finalize) {
        if (tween.vars.onComplete) {
          const userDefinedOnComplete = tween.vars.onComplete;
          return function () {
            userDefinedOnComplete.apply(this, arguments);
            finalize();
          };
        } else {
          tween.vars.onComplete = finalize;
        }
      }

      const position = this.parsePosition(config.position);
      const tChildren = _this.timeline.getChildren(false);
      const firstChild = tChildren[0];
      // console.log(config)

      if (tChildren.length === 0) {
        // if the tween is the very first child then its position can not be negative
        _this.timeline.add(tween, (position && position.indexOf('-=') === -1) ? position : null);
      } else if (tChildren.length === 1 && !firstChild.hasOwnProperty('timeline') && firstChild.getChildren(false).length === 0) {
        // This fix a bug where if the 'enter' animation has addTo, then the 'leave' animation is ignored
        debugger
        _this.timeline.clear(false);
        _this.timeline.add(tween, position);
      } else {
        _this.timeline.add(tween, position);
      }

      if (_this.name === '<user-defined>')
        return tween;

      if (!_this.started) {
        _this.started = true;
        _this.timeline.resume();
      } else if (_this.timeline.paused()) {
        _this.timeline.resume();
      }

      return tween;
    }
  };
})(Galaxy);

/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['checked'] = {
    type: 'prop',
    key: 'checked',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    beforeActivate: function (viewNode, scopeReactiveData, prop, expression) {
      if (!scopeReactiveData) {
        return;
      }

      if (expression && viewNode.blueprint.tag === 'input') {
        throw new Error('input.checked property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = G.View.get_bindings(viewNode.blueprint.checked);
      const id = bindings.propertyKeys[0].split('.').pop();
      const nativeNode = viewNode.node;
      nativeNode.addEventListener('change', function () {
        const data = scopeReactiveData.data[id];
        if (data instanceof Array && nativeNode.type !== 'radio') {
          // if the node does not have value attribute, then we take its default value into the account
          // The default value for checkbox is 'on' but we translate that to true
          const value = nativeNode.hasAttribute('value') ? nativeNode.value : true;
          if (data instanceof Array) {
            if (data.indexOf(value) === -1) {
              data.push(value);
            } else {
              data.splice(data.indexOf(value), 1);
            }
          } else {
            scopeReactiveData.data[id] = [value];
          }
        }
        // if node has a value, then its value will be assigned according to its checked state
        else if (nativeNode.hasAttribute('value')) {
          scopeReactiveData.data[id] = nativeNode.checked ? nativeNode.value : null;
        }
        // if node has no value, then checked state would be its value
        else {
          scopeReactiveData.data[id] = nativeNode.checked;
        }
      });
    },
    update: function (viewNode, value) {
      const nativeNode = viewNode.node;
      viewNode.rendered.then(function () {
        // if (/]$/.test(nativeNode.name)) {
        if (value instanceof Array) {
          if (nativeNode.type === 'radio') {
            console.error('Inputs with type `radio` can not provide array as a value.');
            return console.warn('Read about radio input at: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio');
          }

          const nativeValue = nativeNode.hasAttribute('value') ? nativeNode.value : true;
          nativeNode.checked = value.indexOf(nativeValue) !== -1;
        } else if (nativeNode.hasAttribute('value')) {
          nativeNode.checked = value === nativeNode.value;
        } else {
          nativeNode.checked = value;
        }
      });
    }
  };
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['class'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['class'] = {
    type: 'reactive',
    key: 'class',
    getConfig: function (scope, value) {
      return {
        scope,
        subjects: value,
        reactiveClasses: null,
        observer: null,
      };
    },
    install: function (config) {
      if (this.virtual || config.subjects === null || config.subjects instanceof Array || typeof config.subjects !== 'object') {
        return true;
      }

      // when value is an object
      const viewNode = this;
      const reactiveClasses = config.reactiveClasses = G.View.bind_subjects_to_data(viewNode, config.subjects, config.scope, true);
      const observer = config.observer = new G.Observer(reactiveClasses);
      const animations = viewNode.blueprint.animations || {};
      const gsapExist = !!window.gsap.config;
      if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        viewNode.rendered.then(() => {
          // ToDo: Don't know why this is here. It looks redundant
          // applyClasses(viewNode, reactiveClasses);
          observer.onAll((k) => {
            if (gsapExist && (animations['add:' + k] || animations['remove:' + k])) {
              return;
            }
            applyClasses(viewNode, reactiveClasses);
          });
        });
      } else {
        observer.onAll((k) => {
          if (gsapExist && (animations['add:' + k] || animations['remove:' + k])) {
            return;
          }
          applyClasses(viewNode, reactiveClasses);
        });
      }

      return true;
    },
    /**
     *
     * @param config
     * @param value
     * @param expression
     * @this {Galaxy.View.ViewNode}
     */
    update: function (config, value, expression) {
      if (this.virtual) {
        return;
      }

      /** @type Galaxy.View.ViewNode */
      const viewNode = this;
      const node = viewNode.node;

      if (expression) {
        value = expression();
      }

      if (typeof value === 'string' || value === null || value === undefined) {
        return node.className = value;
      } else if (value instanceof Array) {
        return node.className = value.join(' ');
      }

      if (config.subjects === value) {
        value = config.reactiveClasses;
      }

      // when value is an object
      if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        viewNode.rendered.then(() => {
          applyClasses(viewNode, value);
        });
      } else {
        applyClasses(viewNode, value);
      }
    }
  };

  function getClasses(classes) {
    if (typeof classes === 'string') {
      return [classes];
    } else if (classes instanceof Array) {
      return classes;
    } else if (classes !== null && typeof classes === 'object') {
      let newClasses = [];

      for (let key in classes) {
        if (classes.hasOwnProperty(key) && classes[key]) {
          newClasses.push(key);
        }
      }

      return newClasses;
    }
  }

  function applyClasses(viewNode, classes) {
    const currentClasses = viewNode.node.className || [];
    const newClasses = getClasses(classes);
    if (JSON.stringify(currentClasses) === JSON.stringify(newClasses)) {
      return;
    }

    // G.View.create_in_next_frame(viewNode.index, (_next) => {
    viewNode.node.className = newClasses.join(' ');
    // _next();
    // });
  }
})(Galaxy);


/* global Galaxy */
(function (G) {
  /**
   *
   * @type {Galaxy.View.BlueprintProperty}
   */
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['disabled'] = {
    type: 'attr',
    key: 'disabled',
    update: function (viewNode, value, attr) {
      viewNode.rendered.then(() => {
        if (viewNode.blueprint.tag.toLowerCase() === 'form') {
          const children = viewNode.node.querySelectorAll('input, textarea, select, button');

          if (value) {
            Array.prototype.forEach.call(children, input => input.setAttribute('disabled', ''));
          } else {
            Array.prototype.forEach.call(children, input => input.removeAttribute('disabled'));
          }
        }
      });

      G.View.set_attr(viewNode, value ? '' : null, attr);
    }
  };
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['if'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['if'] = {
    type: 'reactive',
    key: 'if',
    getConfig: function () {
      return {
        throttleId: 0,
      };
    },
    install: function (config) {
      return true;
    },
    /**
     *
     * @this Galaxy.View.ViewNode
     * @param config
     * @param value
     * @param expression
     */
    update: function (config, value, expression) {
      if (config.throttleId !== 0) {
        window.clearTimeout(config.throttleId);
        config.throttleId = 0;
      }

      if (expression) {
        value = expression();
      }

      value = Boolean(value);

      if (!this.rendered.resolved && !this.inDOM) {
        this.blueprint.renderConfig.renderDetached = !value;
      }

      // setTimeout is called before requestAnimationTimeFrame
      config.throttleId = setTimeout(() => {
        if (this.inDOM !== value) {
          this.setInDOM(value);
        }
      });
    }
  };

})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['module'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['module'] = {
    type: 'reactive',
    key: 'module',
    getConfig: function (scope) {
      return {
        previousModule: null,
        moduleMeta: null,
        scope: scope
      };
    },
    install: function () {
      return true;
    },
    update: function handleModule(cache, newModuleMeta, expression) {
      const _this = this;

      if (expression) {
        newModuleMeta = expression();
      }

      if (newModuleMeta === undefined) {
        return;
      }

      if (typeof newModuleMeta !== 'object') {
        return console.error('module property only accept objects as value', newModuleMeta);
      }

      if (newModuleMeta && cache.moduleMeta && newModuleMeta.path === cache.moduleMeta.path) {
        return;
      }

      if (!newModuleMeta || newModuleMeta !== cache.moduleMeta) {
        // When this node has a `if`, calling `clean_content(this)` inside a destroy_in_next_frame cause the animation
        // of this node to be executed before the animations of its children, which is not correct.
        // Calling `clean_content(this)` directly fixes this issue, however it might cause other issues when
        // this node does not use `if`. Therefore, we make sure both cases are covered.
        // if (_this.blueprint.hasOwnProperty('if')) {
        // ToDo: Make this works properly
        clean_content(_this);
        if (cache.loadedModule) {
          cache.loadedModule.destroy();
          cache.loadedModule = null;
        }
        // } else {
        //   G.View.destroy_in_next_frame(_this.index, (_next) => {
        //     clean_content(_this);
        //     _next();
        //   });
        // }
      }



      if (!_this.virtual && newModuleMeta && newModuleMeta.path && newModuleMeta !== cache.moduleMeta) {
        G.View.create_in_next_frame(_this.index, (_next) => {
          module_loader.call(null, _this, cache, newModuleMeta, _next);
        });
      }
      cache.moduleMeta = newModuleMeta;
    }
  };

  const EMPTY_CALL = Galaxy.View.EMPTY_CALL;

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   */
  function clean_content(viewNode) {
    const children = viewNode.getChildNodes();
    for (let i = 0, len = children.length; i < len; i++) {
      const vn = children[i];
      if (vn.processLeaveAnimation === EMPTY_CALL) {
        vn.processLeaveAnimation = function (finalize) {
          finalize();
        };
      }
    }

    viewNode.clean(viewNode.hasAnimation(children));

    // G.View.destroy_in_next_frame(viewNode.index, (_next) => {
    //   let len = viewNode.finalize.length;
    //   for (let i = 0; i < len; i++) {
    //     viewNode.finalize[i].call(viewNode);
    //   }
    //   viewNode.finalize = [];
    //   _next();
    // });
  }

  /**
   *
   * @param viewNode
   * @param cache
   * @param {object} moduleMeta
   * @param _next
   */
  function module_loader(viewNode, cache, moduleMeta, _next) {
    // if (cache.module) {
    //   cache.module.destroy();
    // }
    // Check for circular module loading
    const tempURI = new G.GalaxyURI(moduleMeta.path);
    let moduleScope = cache.scope;
    let currentScope = cache.scope;

    if (typeof moduleMeta.onInvoke === 'function') {
      moduleMeta.onInvoke.call();
    }

    while (moduleScope) {
      // In the case where module is a part of repeat, cache.scope will be NOT an instance of Scope
      // but its __parent__ is
      if (!(currentScope instanceof G.Scope)) {
        currentScope = new G.Scope({
          systemId: 'repeat-item',
          path: cache.scope.__parent__.uri.parsedURL,
          parentScope: cache.scope.__parent__
        });
      }

      if (tempURI.parsedURL === currentScope.uri.parsedURL) {
        return console.error('Circular module loading detected and stopped. \n' + currentScope.uri.parsedURL + ' tries to load itself.');
      }

      moduleScope = moduleScope.parentScope;
    }

    currentScope.load(moduleMeta, {
      element: viewNode
    }).then(function (module) {
      cache.loadedModule = module;
      viewNode.node.setAttribute('module', module.path);
      module.start();

      if (typeof moduleMeta.onLoad === 'function') {
        moduleMeta.onLoad.call();
      }

      _next();
    }).catch(function (response) {
      console.error(response);
      _next();
    });
  }
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['on'] = {
    type: 'prop',
    key: 'on',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param events
     */
    update: function (viewNode, events) {
      if (events !== null && typeof events === 'object') {
        for (let name in events) {
          if (events.hasOwnProperty(name)) {
            const handler = function (event) {
              return events[name].call(viewNode, event, viewNode.data);
            };
            viewNode.node.addEventListener(name, handler, false);
            viewNode.finalize.push(() => {
              viewNode.node.removeEventListener(name, handler, false);
            });
          }
        }
      }
    }
  };
})(Galaxy);

/* global Galaxy */
(function (G) {
  const View = G.View;
  const CLONE = G.clone;
  const destroy_nodes = G.View.destroy_nodes;

  View.REACTIVE_BEHAVIORS['repeat'] = true;
  View.NODE_BLUEPRINT_PROPERTY_MAP['repeat'] = {
    type: 'reactive',
    key: 'repeat',
    getConfig: function (scope, value) {
      this.virtualize();

      return {
        changeId: null,
        previousActionId: null,
        nodes: [],
        data: value.data,
        as: value.as,
        indexAs: value.indexAs || '_index',
        oldChanges: {},
        positions: [],
        trackMap: [],
        scope: scope,
        trackBy: value.trackBy,
        onComplete: value.onComplete
      };
    },

    /**
     *
     * @param config Value return by getConfig
     */
    install: function (config) {
      const viewNode = this;

      if (config.data) {
        if (config.as === 'data') {
          throw new Error('`data` is an invalid value for repeat.as property. Please choose a different value.`');
        }
        viewNode.localPropertyNames.add(config.as);
        viewNode.localPropertyNames.add(config.indexAs);

        const bindings = View.get_bindings(config.data);
        if (bindings.propertyKeys.length) {
          View.make_binding(viewNode, 'repeat', undefined, config.scope, bindings, viewNode);
          bindings.propertyKeys.forEach((path) => {
            try {
              const rd = View.property_rd_lookup(config.scope, path);
              viewNode.finalize.push(() => {
                rd.removeNode(viewNode);
              });
            } catch (error) {
              console.error('Could not find: ' + path + '\n', error);
            }
          });
        } else if (config.data instanceof Array) {
          const setter = viewNode.setters['repeat'] = View.get_property_setter_for_node(G.View.NODE_BLUEPRINT_PROPERTY_MAP['repeat'], viewNode, config.data, null, config.scope);
          const value = new G.View.ArrayChange();
          value.params = config.data;
          config.data.changes = value;
          setter(config.data);
        }
      }

      return false;
    },

    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param config The value returned by getConfig
     * @param value
     * @param {Function} expression
     */
    update: function (config, value, expression) {
      let changes = null;
      if (expression) {
        value = expression();
        if (value === undefined) {
          return;
        }

        if (value === null) {
          throw Error('Invalid return type: ' + value + '\nThe expression function for `repeat.data` must return an instance of Array or Galaxy.View.ArrayChange or undefined');
        }

        if (value instanceof G.View.ArrayChange) {
          changes = value;
        } else if (value instanceof Array) {
          const initialChanges = new G.View.ArrayChange();
          initialChanges.original = value;
          initialChanges.type = 'reset';
          initialChanges.params = value;
          changes = value.changes = initialChanges;
        } else if (value instanceof Object) {
          const output = Object.entries(value).map(([key, value]) => ({ key, value }));
          const initialChanges = new G.View.ArrayChange();
          initialChanges.original = output;
          initialChanges.type = 'reset';
          initialChanges.params = output;
          changes = value.changes = initialChanges;
        } else {
          changes = {
            type: 'reset',
            params: []
          };
        }

        // if (!(changes instanceof Galaxy.View.ArrayChange)) {
        //   debugger;
        //   throw new Error('repeat: Expression has to return an ArrayChange instance or null \n' + config.watch.join(' , ') + '\n');
        // }
      } else {
        if (value instanceof G.View.ArrayChange) {
          changes = value;
        } else if (value instanceof Array) {
          changes = value.changes;
        } else if (value instanceof Object) {
          const output = Object.entries(value).map(([key, value]) => ({ key, value }));
          changes = new G.View.ArrayChange();
          changes.original = output;
          changes.type = 'reset';
          changes.params = output;
        }
      }

      if (changes && !(changes instanceof G.View.ArrayChange)) {
        return console.warn('%crepeat %cdata is not a type of ArrayChange' +
          '\ndata: ' + config.data +
          '\n%ctry \'' + config.data + '.changes\'\n', 'color:black;font-weight:bold', null, 'color:green;font-weight:bold');
      }

      if (!changes || typeof changes === 'string') {
        changes = {
          id: 0,
          type: 'reset',
          params: []
        };
      }

      const node = this;
      if (changes.id === config.changeId) {
        return;
      }

      // Only cancel previous action if the type of new and old changes is reset
      // if (changes.type === 'reset' && changes.type === config.oldChanges.type && config.previousActionId) {
      //   cancelAnimationFrame(config.previousActionId);
      // }

      config.changeId = changes.id;
      config.oldChanges = changes;
      processChanges(node, config, prepareChanges(node, config, changes));
    }
  };

  function prepareChanges(viewNode, config, changes) {
    const hasAnimation = viewNode.blueprint.animations && viewNode.blueprint.animations.leave;
    const trackByKey = config.trackBy;
    if (trackByKey && changes.type === 'reset') {
      let newTrackMap;
      if (trackByKey === true) {
        newTrackMap = changes.params.map(item => {
          return item;
        });
      } else if (typeof trackByKey === 'string') {
        newTrackMap = changes.params.map(item => {
          return item[trackByKey];
        });
      }

      // list of nodes that should be removed
      const hasBeenRemoved = [];
      config.trackMap = config.trackMap.filter(function (id, i) {
        if (newTrackMap.indexOf(id) === -1 && config.nodes[i]) {
          hasBeenRemoved.push(config.nodes[i]);
          return false;
        }
        return true;
      });

      const newChanges = new G.View.ArrayChange();
      newChanges.init = changes.init;
      newChanges.type = changes.type;
      newChanges.original = changes.original;
      newChanges.params = changes.params;
      newChanges.__rd__ = changes.__rd__;
      if (newChanges.type === 'reset' && newChanges.params.length) {
        newChanges.type = 'push';
      }

      config.nodes = config.nodes.filter(function (node) {
        return hasBeenRemoved.indexOf(node) === -1;
      });

      destroy_nodes(hasBeenRemoved, hasAnimation);
      return newChanges;
    } else if (changes.type === 'reset') {
      const nodesToBeRemoved = config.nodes.slice(0);
      config.nodes = [];
      destroy_nodes(nodesToBeRemoved, hasAnimation);
      const newChanges = Object.assign({}, changes);
      newChanges.type = 'push';
      return newChanges;
    }

    return changes;
  }

  function processChanges(viewNode, config, changes) {
    const parentNode = viewNode.parent;
    // const positions = config.positions;
    const positions = [];
    const placeholders = [];
    const nodeScopeData = config.scope;
    const trackMap = config.trackMap;
    const as = config.as;
    const indexAs = config.indexAs;
    const nodes = config.nodes;
    const trackByKey = config.trackBy;
    const templateBlueprint = viewNode.cloneBlueprint();
    templateBlueprint.repeat = null;

    let defaultPosition = nodes.length ? nodes[nodes.length - 1].anchor.nextSibling : viewNode.placeholder.nextSibling;
    let newItems = [];
    let onEachAction;
    if (trackByKey === true) {
      onEachAction = function (vn, p, d) {
        trackMap.push(d);
        this.push(vn);
      };
    } else if (typeof trackByKey === 'string') {
      onEachAction = function (vn, p, d) {
        trackMap.push(d[config.trackBy]);
        this.push(vn);
      };
    } else {
      onEachAction = function (vn, p, d) {
        this.push(vn);
      };
    }

    if (changes.type === 'push') {
      newItems = changes.params;
    } else if (changes.type === 'unshift') {
      defaultPosition = nodes[0] ? nodes[0].anchor : defaultPosition;
      newItems = changes.params;

      if (trackByKey === true) {
        onEachAction = function (vn, p, d) {
          trackMap.unshift(d);
          this.unshift(vn);
        };
      } else {
        onEachAction = function (vn, p, d) {
          trackMap.unshift(d[trackByKey]);
          this.unshift(vn);
        };
      }
    } else if (changes.type === 'splice') {
      const changeParams = changes.params.slice(0, 2);
      const removedItems = Array.prototype.splice.apply(nodes, changeParams);
      destroy_nodes(removedItems.reverse(), viewNode.blueprint.animations && viewNode.blueprint.animations.leave);
      Array.prototype.splice.apply(trackMap, changeParams);

      const startingIndex = changes.params[0];
      newItems = changes.params.slice(2);
      for (let i = 0, len = newItems.length; i < len; i++) {
        const index = i + startingIndex;
        positions.push(index);
        placeholders.push(nodes[index] ? nodes[index].anchor : defaultPosition);
      }

      if (trackByKey === true) {
        onEachAction = function (vn, p, d) {
          trackMap.splice(p, 0, d);
          this.splice(p, 0, vn);
        };
      } else {
        onEachAction = function (vn, p, d) {
          trackMap.splice(p, 0, d[trackByKey]);
          this.splice(p, 0, vn);
        };
      }
    } else if (changes.type === 'pop') {
      const lastItem = nodes.pop();
      lastItem && lastItem.destroy();
      trackMap.pop();
    } else if (changes.type === 'shift') {
      const firstItem = nodes.shift();
      firstItem && firstItem.destroy();
      trackMap.shift();
    } else if (changes.type === 'sort' || changes.type === 'reverse') {
      nodes.forEach(function (viewNode) {
        viewNode.destroy();
      });

      config.nodes = [];
      newItems = changes.original;
      Array.prototype[changes.type].call(trackMap);
    }

    const view = viewNode.view;
    if (newItems instanceof Array) {
      const newItemsCopy = newItems.slice(0);
      // let vn;
      if (trackByKey) {
        if (trackByKey === true) {
          for (let i = 0, len = newItems.length; i < len; i++) {
            const newItemCopy = newItemsCopy[i];
            const index = trackMap.indexOf(newItemCopy);
            if (index !== -1) {
              config.nodes[index].data._index = index;
              continue;
            }

            createNode(view, templateBlueprint, nodeScopeData, as, newItemCopy, indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
          }
        } else {
          for (let i = 0, len = newItems.length; i < len; i++) {
            const newItemCopy = newItemsCopy[i];
            const index = trackMap.indexOf(newItemCopy[trackByKey]);
            if (index !== -1) {
              config.nodes[index].data._index = index;
              continue;
            }

            createNode(view, templateBlueprint, nodeScopeData, as, newItemCopy, indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
          }
        }
      } else {
        for (let i = 0, len = newItems.length; i < len; i++) {
          createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy[i], indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
        }
      }

      if (config.onComplete) {
        View.create_in_next_frame(viewNode.index, (_next) => {
          config.onComplete(nodes);
          _next();
        });
      }
    }
  }

  function createItemDataScope(nodeScopeData, as, itemData) {
    const itemDataScope = View.create_child_scope(nodeScopeData);
    itemDataScope[as] = itemData;
    return itemDataScope;
  }

  function createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy, indexAs, i, parentNode, position, onEachAction, nodes, positions) {
    const itemDataScope = createItemDataScope(nodeScopeData, as, newItemsCopy);
    const cns = CLONE(templateBlueprint);
    itemDataScope[indexAs] = i;

    const vn = view.createNode(cns, itemDataScope, parentNode, position);
    onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
  }
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['selected'] = {
    type: 'prop',
    key: 'selected',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    beforeActivate: function (viewNode, scopeReactiveData, prop, expression) {
      if (!scopeReactiveData) {
        return;
      }

      if (expression && viewNode.blueprint.tag === 'select') {
        throw new Error('select.selected property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      // Don't do anything if the node is an option tag
      if (viewNode.blueprint.tag === 'select') {
        const bindings = G.View.get_bindings(viewNode.blueprint.selected);
        const id = bindings.propertyKeys[0].split('.').pop();
        const nativeNode = viewNode.node;
        nativeNode.addEventListener('change', (event) => {
          console.log(viewNode.node, 'SELECTED', event);
        });
      }
    },
    update: function (viewNode, value) {
      const nativeNode = viewNode.node;

      viewNode.rendered.then(function () {
        if (nativeNode.value !== value) {
          if (viewNode.blueprint.tag === 'select') {
            nativeNode.value = value;
          } else if (value) {
            nativeNode.setAttribute('selected', true);
          } else {
            nativeNode.removeAttribute('selected');
          }
        }
      });
    }
  };
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['style'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['style_3'] = {
    type: 'prop',
    key: 'style'
  };
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['style_8'] = {
    type: 'prop',
    key: 'style'
  };
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['style'] = {
    type: 'reactive',
    key: 'style',
    getConfig: function (scope, value) {
      return {
        scope: scope,
        subjects: value,
        reactiveStyle: null
      };
    },
    install: function (config) {
      if (this.virtual || config.subjects === null || config.subjects instanceof Array || typeof config.subjects !== 'object') {
        return true;
      }

      const node = this.node;
      const reactiveStyle = config.reactiveStyle = G.View.bind_subjects_to_data(this, config.subjects, config.scope, true);
      const observer = new G.Observer(reactiveStyle);
      observer.onAll(() => {
        setStyle(node, reactiveStyle);
      });

      return true;
    },
    /**
     *
     * @param config
     * @param value
     * @param expression
     * @this {Galaxy.View.ViewNode}
     */
    update: function (config, value, expression) {
      if (this.virtual) {
        return;
      }

      const _this = this;
      const node = _this.node;

      if (expression) {
        value = expression();
      }

      if (typeof value === 'string') {
        return node.style = value;
      } else if (value instanceof Array) {
        return node.style = value.join(';');
      }

      if (value instanceof Promise) {
        value.then(function (_value) {
          setStyle(node, _value);
        });
      } else if (value === null) {
        return node.removeAttribute('style');
      }

      if (config.subjects === value) {
        // return setStyle(node, config.reactiveStyle);
        value = config.reactiveStyle;
      }

      setStyle(node, value);
    }
  };

  function setStyle(node, value) {
    if (value instanceof Object) {
      for (let key in value) {
        const val = value[key];
        if (val instanceof Promise) {
          val.then((v) => {
            node.style[key] = v;
          });
        } else if (typeof val === 'function') {
          node.style[key] = val.call(node.__vn__, node.__vn__.data);
        } else {
          node.style[key] = val;
        }
      }
    } else {
      node.style = value;
    }
  }
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['text_3'] = {
    type: 'prop',
    key: 'nodeValue'
  };
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['text_8'] = {
    type: 'prop',
    key: 'nodeValue'
  };
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['text'] = {
    type: 'prop',
    key: 'text',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param value
     */
    update: function (viewNode, value) {
      let textValue = typeof value === 'undefined' || value === null ? '' : value;
      if (textValue instanceof Object) {
        textValue = JSON.stringify(textValue);
      }

      const nativeNode = viewNode.node;
      const textNode = nativeNode['<>text'];
      if (textNode) {
        textNode.nodeValue = textValue;
      } else {
        const tn = nativeNode['<>text'] = document.createTextNode(textValue);
        nativeNode.insertBefore(tn, nativeNode.firstChild);
      }
    }
  };
})(Galaxy);

/* global Galaxy */
(function (G) {
  const IGNORE_TYPES = [
    'radio',
    'checkbox',
    'button',
    'reset',
    'submit'
  ];

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['value.config'] = {
    type: 'none'
  };

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['value'] = {
    type: 'prop',
    key: 'value',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {Galaxy.View.ReactiveData} scopeReactiveData
     * @param prop
     * @param {Function} expression
     */
    beforeActivate: function valueUtil(viewNode, scopeReactiveData, prop, expression) {
      const nativeNode = viewNode.node;
      if (!scopeReactiveData || IGNORE_TYPES.indexOf(nativeNode.type) !== -1) {
        return;
      }

      if (expression) {
        throw new Error('input.value property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = G.View.get_bindings(viewNode.blueprint.value);
      const id = bindings.propertyKeys[0].split('.').pop();
      if (nativeNode.tagName === 'SELECT') {
        const observer = new MutationObserver((data) => {
          viewNode.rendered.then(() => {
            // Set the value after the children are rendered
            nativeNode.value = scopeReactiveData.data[id];
          });
        });
        observer.observe(nativeNode, { childList: true });
        viewNode.finalize.push(() => {
          observer.disconnect();
        });
        nativeNode.addEventListener('change', createHandler(scopeReactiveData, id));
      } else if (nativeNode.type === 'number' || nativeNode.type === 'range') {
        nativeNode.addEventListener('input', createNumberHandler(nativeNode, scopeReactiveData, id));
      } else {
        nativeNode.addEventListener('input', createHandler(scopeReactiveData, id));
      }
    },
    update: function (viewNode, value) {
      // input field parse the value which has been passed to it into a string
      // that's why we need to parse undefined and null into an empty string
      if (value !== viewNode.node.value || !viewNode.node.value) {
        viewNode.node.value = value === undefined || value === null ? '' : value;
      }
    }
  };

  function createNumberHandler(_node, _rd, _id) {
    return function () {
      _rd.data[_id] = _node.value ? Number(_node.value) : null;
    };
  }

  function createHandler(_rd, _id) {
    return function (event) {
      _rd.data[_id] = event.target.value;
    };
  }
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['visible'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['visible'] = {
    type: 'reactive',
    key: 'visible',
    getConfig: function () {
      return {
        throttleId: 0,
      };
    },
    install: function () {
      return true;
    },
    update: function (config, value, expression) {
      if (config.throttleId !== 0) {
        window.clearTimeout(config.throttleId);
        config.throttleId = 0;
      }
      /** @type {Galaxy.View.ViewNode} */
      if (expression) {
        value = expression();
      }

      // setTimeout is called before requestAnimationTimeFrame
      config.throttleId = window.setTimeout(() => {
        if (this.visible !== value) {
          this.setVisibility(value);
        }
      });
    }
  };
})(Galaxy);


/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.attr = function (viewNode, property, expression) {
    const attrName = property.key;
    const updateFn = property.update || G.View.set_attr;
    const setter = create_attr_setter(updateFn, viewNode, attrName);

    if (expression) {
      return function A_EXP() {
        const expressionValue = expression();
        setter(expressionValue);
      };
    }

    return setter;
  };

  function create_attr_setter(updateFn, viewNode, attrName) {
    return function A(value) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          updateFn(viewNode, asyncValue, attrName);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        updateFn(viewNode, result, attrName);
      } else {
        updateFn(viewNode, value, attrName);
      }
    };
  }
})(Galaxy);

/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.prop = function (viewNode, property, expression) {
    const propName = property.key;
    const updateFn = property.update || G.View.set_prop;
    const setter = create_prop_setter(updateFn, viewNode, propName);
    if (expression) {
      return function P_EXP() {
        const expressionValue = expression();
        setter(expressionValue);
      };
    }

    return setter;
  };

  function create_prop_setter(updateFn, viewNode, propName) {
    return function P(value) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          updateFn(viewNode, asyncValue, propName);
        };
        value.then(asyncCall).catch(asyncCall);
      } else if (value instanceof Function) {
        const result = value.call(viewNode, viewNode.data);
        updateFn(viewNode, result, propName);
      } else {
        updateFn(viewNode, value, propName);
      }
    };
  }
})(Galaxy);

/* global Galaxy */
(function (G) {
  G.View.PROPERTY_SETTERS.reactive = function (viewNode, property, expression, scope) {
    const propertyName = property.key;
    const updateFn = property.update;
    const config = viewNode.cache[propertyName];

    return create_reactive_setter(updateFn, viewNode, config, expression, scope);
  };

  function create_reactive_setter(updateFn, vn, config, expression, scope) {
    const nodeUpdateFn = updateFn.bind(vn);
    return function R(value) {
      return nodeUpdateFn(config, value, expression, scope);
    };
  }
})(Galaxy);
