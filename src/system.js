/* global Galaxy, nanoajax, Node */

(function (root) {

  root.Galaxy = new System();

  /** The main class of the GalaxyJS. window.galaxy is an instance of this class.
   *
   * @returns {Galaxy.GalaxySystem}
   */
  Galaxy.GalaxySystem = System;

  var entities = {};
  var importedLibraries = {};

  function System () {
    this.stateKey = '#';
    this.registry = {};
    this.modules = {};
    this.activities = {};
    this.uiTemplates = {};
    this.onLoadQueue = [];
    this.notYetStarted = [];
    this.activeRequests = {};
    this.onModuleLoaded = {};
    this.services = {};
    this.modulesHashes = {};
    this.hashChecker = null;
    this.firstTime = false;
    this.scopeServices = [];
    this.inited = false;
    this.app = null;
  }

  System.prototype.createState = function (id) {
    var module;
    var domain = this;
    if (!domain) {
      throw 'Domain can NOT be null';
    }
    id = this.app.id + '/' + id;

    if (domain.modules[ id ]) {
      return domain.modules[ id ];
    }

    module = new Galaxy.GalaxyModule();
    module.domain = domain;
    module.id = id;
    module.stateId = id.replace('system/', '');

    domain.modules[ id ] = module;

    return module;
  };

  System.prototype.state = function (id, handler) {
    //return this.app.module(id, object, false);
    var module, modulePath, moduleNavigation;
    var domain = this;
    if (!domain) {
      throw 'Domain can NOT be null';
    }
    id = this.app.id + '/' + id;

    //if forceReload is true, then init the module again
    if (!handler/* && this.modules[id]*/) {
      // Add the module to notYetStarted list so it can be started by startLastLoadedModule method
      domain.notYetStarted.push(id);
      return domain.modules[ id ];
    }

    if (domain.modules[ id ]) {
      return domain.modules[ id ];
    }

    if (typeof (handler) === 'function') {
      module = new Galaxy.GalaxyModule();
      module.domain = domain;
      module.id = id;
      module.stateId = id.replace('system/', '');

      handler.call(null, module);
    } else {
      module = Galaxy.utility.extend(new Galaxy.GalaxyModule(), handler || {});
      module.domain = domain;
      module.id = id;
      module.stateId = id.replace('system/', '');
    }

    modulePath = domain.app.navigation[ module.stateKey ] ? domain.app.navigation[ module.stateKey ] : [];
    moduleNavigation = Galaxy.utility.extend(true, {}, domain.app.navigation);
    moduleNavigation[ module.stateKey ] = modulePath.slice(id.split("/").length - 1);

    domain.modules[ id ] = module;
    domain.notYetStarted.push(id);

    // Set module hash for this module when its inited
    // module hash will be set in the hashChanged method as well
    // if current navigation path is equal to this module id
    //module.hash = Galaxy.modulesHashes[id.replace("system/", "")] = module.stateKey + "=" + id.replace("system/", "");

    module.init(moduleNavigation, domain.app.params);

    return module;
  };

  System.prototype.newStateHandler = function (scope, handler) {
    var app = this.getHashParam('#');

    if (app.indexOf(scope.stateId) === 0) {
      return this.state(scope.stateId, handler);
    } else {
      scope._doNotRegister = true;
    }

    return null;
  };

  System.prototype.on = function (id, handler) {
    this.app.on.call(this.app, id, handler);
  };

  System.prototype.start = function () {
    var _this = this;

    if (!_this.inited) {
      throw new Error('Galaxy is not initialized');
    }

    var detect = function () {
      if (_this.app.oldHash !== window.location.hash || _this.app.newListenerAdded) {
        var oldParesedHash = _this.parseHash(_this.app.oldHash);
        var parsedHash = _this.parseHash(window.location.hash);

        _this.setModuleHashValue(parsedHash.navigation, parsedHash.params, parsedHash.hash);
        // If the user changes only the app(#) parameter in the url, 
        // then the old hash of the requested module would be considered instead of the value of the url
        // if user make more changes, then the old hash of the requested module will be ignored and url value will be taken
        if (oldParesedHash.params[ '#' ] !== parsedHash.params[ '#' ]) {
          var temp = Galaxy.utility.clone(parsedHash.params);
          delete oldParesedHash.params[ '#' ];
          delete temp[ '#' ];

          if (JSON.stringify(temp) === JSON.stringify(oldParesedHash.params) && JSON.stringify(temp) !== '{}') {
            return Galaxy.app.setParam('#', parsedHash.params[ '#' ]);
          } else {
            Galaxy.modulesHashes[ parsedHash.params[ '#' ] ] = parsedHash.hash;
          }
        }

        _this.app.hashChanged(parsedHash.navigation, parsedHash.params, parsedHash.hash, parsedHash.navigation[ _this.app.stateKey ]); // Galaxy
        _this.app.oldHash = parsedHash.hash;
        _this.app.newListenerAdded = false;
      }
    };

    detect();
    clearInterval(this.hashChecker);
    this.hashChecker = setInterval(function () {
      detect();
    }, 50);
  };

  System.prototype.setModuleHashValue = function (navigation, parameters, hashValue, init) {
    var nav = parameters[ '#' ];

    if (!nav) {
      return hashValue;
    }

    if (Galaxy.modulesHashes[ nav ] && Galaxy.app.activeModule !== Galaxy.modules[ 'system/' + nav ] &&
      Galaxy.app.activeModule && Galaxy.app.activeModule.stateKey === '#') {
      return Galaxy.modulesHashes[ nav ];
      // When the navigation path is changed
    } else if (!this.firstTime) {
      // first time indicates that the page is (re)loaded and the window.location.hash should be set
      // as the module hash value for the module which is specified by app parameter in the hash value.
      // Other modules get default hash value
      Galaxy.modulesHashes[ nav ] = hashValue;
      this.firstTime = true;
      return Galaxy.modulesHashes[ nav ];
    } else if (!Galaxy.modulesHashes[ nav ]) {
      // When the module does not exist 
      Galaxy.modulesHashes[ nav ] = '#' + nav;
      return Galaxy.modulesHashes[ nav ];
    } else if (Galaxy.modulesHashes[ nav ]) {
      // When the hash parameters value is changed from the browser url bar or originated from url bar
      Galaxy.modulesHashes[ nav ] = hashValue;
    }
    return hashValue;
  };

  System.prototype.parseHash = function (hash) {
    var navigation = {};
    var params = {};
    var paramters = hash.replace(/^#([^&]*)\/?/igm, function (m, v) {
      navigation[ '#' ] = v.split('/').filter(Boolean);
      params[ '#' ] = v;
      return '';
    });

    paramters.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
      navigation[ k ] = v.split('/').filter(Boolean);
      params[ k ] = v;
    });

    return {
      hash: hash,
      navigation: navigation,
      params: params
    };
  };

  System.prototype.init = function (mods) {
    if (this.inited) {
      throw new Error('Galaxy is initialized already');
    }

    var app = new Galaxy.GalaxyModule();
    this.app = app;

    app.domain = this;
    app.stateKey = this.stateKey;
    app.id = 'system';
    app.installModules = mods || [];
    app.init({}, {}, 'system');
    app.oldHash = window.location.hash;
    app.params = this.parseHash(window.location.hash).params;
    this.inited = true;
  };

  var CONTENT_PARSERS = {};

  CONTENT_PARSERS[ 'text/html' ] = function (content) {
    var scripts = [];
    var imports = [];

    var raw = Galaxy.utility.parseHTML(content);
    //var scripts = raw.filter("script").remove();
    var html = raw.filter(function (e) {
      if (e.nodeType === Node.ELEMENT_NODE) {
        var scriptTags = Array.prototype.slice.call(e.querySelectorAll('script'));

        scriptTags.forEach(function (tag) {
          scripts.push(tag.innerHTML);
          tag.parentNode.removeChild(tag);
        });
      }

      if (e.tagName && e.tagName.toLowerCase() === 'script') {
        scripts.push(e.innerHTML);
        return false;
      }

      if (e.tagName && e.tagName.toLowerCase() === 'import') {
        imports.push({
          name: e.getAttribute('name'),
          from: e.getAttribute('from'),
          fresh: e.hasAttribute('fresh')
        });

        return false;
      }

      return true;
    });

    var temp = document.createElement('div');
    for (var i = 0, len = html.length; i < len; i++) {
      html[ i ] = temp.appendChild(html[ i ]);
    }
    document.getElementsByTagName('body')[ 0 ].appendChild(temp);
    var uiView = temp.querySelectorAll('ui-view,[ui-view]');
    temp.parentNode.removeChild(temp);

    return {
      html: html,
      imports: imports,
      views: uiView,
      script: scripts.join('\n')
    };
  };

  var javascriptParser = function (content) {
    return {
      html: [],
      imports: [],
      views: [],
      script: content
    };
  };

  CONTENT_PARSERS[ 'text/javascript' ] = javascriptParser;
  CONTENT_PARSERS[ 'application/javascript' ] = javascriptParser;

  System.prototype.parseModuleContent = function (module, content, contentType) {
    var parser = CONTENT_PARSERS[ contentType.toLowerCase() ];
    if (parser) {
      return parser(content);
    } else {
      console.log('Resource is not a valid html file:', module.url, contentType);

      return {
        html: [],
        imports: [],
        views: [],
        script: ''
      };
    }
  };

  System.prototype.load = function (module, onDone) {
    var _this = this;
    module.id = module.id || 'noid-' + (new Date()).valueOf() + '-' + Math.round(performance.now());

    Galaxy.onModuleLoaded[ 'system/' + module.id ] = onDone;
    var moduleExist = Galaxy.modules[ 'system/' + module.id ];

    var invokers = [ module.url ];

    if (module.invokers) {
      if (module.invokers.indexOf(module.url) !== -1) {
        throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
      }

      invokers = module.invokers;
      invokers.push(module.url);
    }

    if (moduleExist) {
      var ol = Galaxy.onModuleLoaded[ 'system/' + module.id ];
      if ('function' === typeof (ol)) {
        window.requestAnimationFrame(function () {
          ol.call(_this, moduleExist, moduleExist.scope.html);
          delete Galaxy.onModuleLoaded[ 'system/' + module.id ];
        });
      }

      return;
    }

    if (Galaxy.onLoadQueue[ 'system/' + module.id ]) {
      return;
    }

    Galaxy.onLoadQueue[ 'system/' + module.id ] = true;

    fetch(module.url + '?' + Galaxy.utility.serialize(module.params || {})).then(function (response) {
      var contentType = response.headers.get('content-type').split(';')[ 0 ] || 'text/html';
      response.text().then(function (htmlText) {
        var parsedContent = _this.parseModuleContent(module, htmlText, contentType);
        window.requestAnimationFrame(function () {
          compile(parsedContent);
        });
      });
    });

    function compile (moduleContent) {
      var scopeUIViews = {};
      Array.prototype.forEach.call(moduleContent.views, function (node, i) {
        var uiViewName = node.getAttribute('ui-view');
        scopeUIViews[ uiViewName || 'view_' + i ] = node;
      });

      var scope = {
        moduleId: 'system/' + module.id,
        stateId: module.id,
        parentScope: module.scope || null,
        html: moduleContent.html,
        views: scopeUIViews,
        imports: {}
      };

      module.scopeServices = [];

      var imports = Array.prototype.slice.call(moduleContent.imports, 0);
      var scriptContent = moduleContent.script || '';

      // extract imports from the source code
      scriptContent = scriptContent.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
      moduleContent.script = scriptContent.replace(/Scope\.import\(['|"](.*)['|"]\)\;/gm, function (match, path) {
        var query = path.match(/([\S]+)/gm);
        imports.push({
          url: query[ query.length - 1 ],
          fresh: query.indexOf('new') !== -1
        });

        return "Scope.imports['" + query[ query.length - 1 ] + "']";
      });

      if (imports.length) {
        var importsCopy = imports.slice(0);
        imports.forEach(function (item, i) {

          var scopeService = Galaxy.getScopeService(item.url);
          if (scopeService) {
            var scopeServiceHandler = scopeService.handler.call(null, scope);
            importedLibraries[ item.url ] = {
              name: item.url,
              module: scopeServiceHandler.pre()
            };
            module.scopeServices.push(scopeServiceHandler);

            doneImporting(module, scope, importsCopy, moduleContent);
          } else if (importedLibraries[ item.url ] && !item.fresh) {
            doneImporting(module, scope, importsCopy, moduleContent);
          } else {
            Galaxy.load({
              id: (new Date()).valueOf() + '-' + performance.now(),
              name: item.name,
              url: item.url,
              fresh: item.fresh,
              scope: scope,
              invokers: invokers,
              temprory: true
            }, function (loaded) {
              doneImporting(module, scope, importsCopy, moduleContent);
            });
          }
        });

        return false;
      }

      moduleLoaded(module, scope, moduleContent);
    }

    function doneImporting (module, scope, imports, moduleContent) {
      imports.splice(imports.indexOf(module.url) - 1, 1);

      if (imports.length === 0) {
        // This will load the original initilizer
        moduleLoaded(module, scope, moduleContent);
      }
    }

    function moduleLoaded (module, scope, filtered) {
      for (var item in importedLibraries) {
        if (importedLibraries.hasOwnProperty(item)) {
          var asset = importedLibraries[ item ];
          scope.imports[ asset.name ] = asset.module;
        }
      }

      var html = document.createDocumentFragment();

      scope.html.forEach(function (item) {
        html.appendChild(item);
      });

      scope.html = html;
      html._scope = scope;
      var currentComponentScripts = filtered.script;
      delete filtered.script;

      var componentScript = new Function('Scope', currentComponentScripts);
      componentScript.call(null, scope);

      module.scopeServices.forEach(function (item) {
        item.post();
      });

      var htmlNodes = [];
      for (var i = 0, len = html.childNodes.length; i < len; i++) {
        htmlNodes.push(html.childNodes[ i ]);
      }

      scope.html = htmlNodes;
      if (!importedLibraries[ module.url ]) {
        importedLibraries[ module.url ] = {
          name: module.name || module.url,
          module: scope.export
        };
      } else if (module.fresh) {
        importedLibraries[ module.url ].module = scope.export;
      } else {
        scope.imports[ module.name ] = importedLibraries[ module.url ].module;
      }
//        delete scope.export;

      var currentModule = Galaxy.modules[ 'system/' + module.id ];

      if (module.temprory || scope._doNotRegister) {
        delete scope._doNotRegister;
        currentModule = {};
      } else if (!currentModule) {
        currentModule = Galaxy.modules[ 'system/' + module.id ] = {};
      }

      currentModule.scope = scope;

      if ('function' === typeof (Galaxy.onModuleLoaded[ 'system/' + module.id ])) {
        Galaxy.onModuleLoaded[ 'system/' + module.id ].call(this, currentModule, scope.html);
        delete Galaxy.onModuleLoaded[ 'system/' + module.id ];
      }

      delete Galaxy.onLoadQueue[ 'system/' + module.id ];
    }
  };

  System.prototype.setURLHash = function (hash) {
    hash = hash.replace(/^#\/?/igm, '');
    var navigation = {};
    var params = {};
    hash.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
      navigation[ k ] = v.split('/').filter(Boolean);
      params[ k ] = v;
    });

  };

  System.prototype.getHashParam = function (key, hashName) {
    var asNumber = parseFloat(this.app.params[ key ]);
    return asNumber || this.app.params[ key ] || null;
  };

  System.prototype.getHashNav = function (key, hashName) {
    return this.app.navigation[ key ] || [];
  };

  /** Set parameters for app/nav. if app/nav was not in parameters, then set paraters for current app/nav
   *
   * @param {Object} parameters
   * @param {Boolean} replace if true it overwrites last url history otherwise it create new url history
   * @param {Boolean} clean clean all the existing parameters
   * @returns {undefined}
   */
  System.prototype.setHashParameters = function (parameters, replace, clean) {
    var newParams = Galaxy.utility.clone(parameters);
    this.lastHashParams = parameters;
    var hashValue = window.location.hash;
    var nav = parameters[ '#' ];

    if (nav && !Galaxy.modulesHashes[ nav ]) {
      Galaxy.modulesHashes[ nav ] = hashValue = '#' + nav;

    } else if (nav && Galaxy.modulesHashes[ nav ]) {
      hashValue = Galaxy.modulesHashes[ nav ];

    }

    var newHash = '';
    hashValue = hashValue.replace(/^#([^&]*)\/?/igm, function (m, v) {
      if (newParams[ '#' ] !== null && typeof newParams[ '#' ] !== 'undefined') {
        newHash += '#' + newParams[ '#' ] + '&';

        delete newParams[ '#' ];
      } else if (!newParams.hasOwnProperty('#') && !clean) {
        newHash += '#' + v + '&';
      }
    });

    hashValue.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
      if (newParams[ k ] !== null && typeof newParams[ k ] !== 'undefined') {
        newHash += k + "=" + newParams[ k ];
        newHash += '&';

        delete newParams[ k ];
      } else if (!newParams.hasOwnProperty(k) && !clean) {
        newHash += k + "=" + v;
        newHash += '&';
      }
    });

    for (var key in newParams) {
      if (newParams.hasOwnProperty(key)) {
        var value = newParams[ key ];
        if (key && value) {
          newHash += key + '=' + value + '&';
        }
      }
    }

    newHash = newHash.replace(/\&$/, '');

    if (replace) {
      window.location.replace(('' + window.location).split('#')[ 0 ] + newHash);
    } else {
      window.location.hash = newHash.replace(/\&$/, '');
    }
  };

  System.prototype.setParamIfNull = function (param, value) {
    this.app.setParamIfNull(param, value);
  };

  System.prototype.loadDependecies = function (dependecies) {
    for (var key in dependecies) {

    }
  };

  System.prototype.getScopeService = function (name) {
    return this.scopeServices.filter(function (service) {
      return service.name === name;
    })[ 0 ];
  };

  System.prototype.registerScopeService = function (name, handler) {
    if (typeof handler !== 'function') {
      throw 'scope service should be a function';
    }

    this.scopeServices.push({
      name: name,
      handler: handler
    });
  };

  System.prototype.boot = function (bootModule, onDone) {
    var _this = this;
    _this.init();

    _this.load(bootModule, function (module) {
      onDone.call(null, module);
      _this.start();
    });
  };

}(this));

