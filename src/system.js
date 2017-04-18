/* global Galaxy, nanoajax, Node */

(function (root) {

  root.Galaxy = new System();

  /** The main class of the GalaxyJS. window.galaxy is an instance of this class.
   *
   * @returns {Galaxy.GalaxySystem}
   */
  Galaxy.GalaxySystem = System;

  var importedLibraries = {};

  function System () {
    this.stateKey = '#';
    this.modules = {};
    this.onLoadQueue = [];
    this.notYetStarted = [];
    this.onModuleLoaded = {};
    this.modulesHashes = {};
    this.hashChecker = null;
    this.firstTime = false;
    this.scopeServices = [];
    this.inited = false;
    this.app = null;
  }

  // System.prototype.createState = function (id) {
  //   var module;
  //   var domain = this;
  //   if (!domain) {
  //     throw 'Domain can NOT be null';
  //   }
  //
  //   if (domain.modules[ id ]) {
  //     return domain.modules[ id ];
  //   }
  //
  //   module = new Galaxy.GalaxyStateHandler({
  //     id: id.replace('system/', ''),
  //     systemId: id,
  //     domain: domain
  //   });
  //
  //   // domain.modules[ id ] = module;
  //
  //   return module;
  // };

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

    var appModule = new Galaxy.GalaxyModule({
      id: 'system',
      systemId: 'system',
      domain: this
    }, null);

    this.app = new Galaxy.GalaxyStateHandler(appModule);
    this.app.oldHash = window.location.hash;
    this.app.params = this.parseHash(window.location.hash).params;
    this.app.init(mods);
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

  System.prototype.compileModuleContent = function (module, moduleContent, invokers, onDone) {
    var scopeUIViews = {};
    Array.prototype.forEach.call(moduleContent.views, function (node, i) {
      scopeUIViews[ node.getAttribute('ui-view') || 'view_' + i ] = node;
    });

    var scope = new Galaxy.GalaxyScope(module, moduleContent.html, scopeUIViews);
    module = new Galaxy.GalaxyModule(module, scope);
    Galaxy.modules[ module.systemId ] = module;
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

    module.services = module.services || {};
    if (imports.length) {
      var importsCopy = imports.slice(0);
      imports.forEach(function (item, i) {
        var scopeService = Galaxy.getScopeService(item.url);
        if (scopeService) {
          var scopeServiceHandler = scopeService.handler.call(null, scope, module);
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
            name: item.name,
            url: item.url,
            fresh: item.fresh,
            parentScope: scope,
            invokers: invokers,
            temporary: true
          }, function (loaded) {
            doneImporting(module, scope, importsCopy, moduleContent);
          });
        }
      });

      return false;
    }

    onDone(module, scope, moduleContent);

    function doneImporting (module, scope, imports, moduleContent) {
      imports.splice(imports.indexOf(module.url) - 1, 1);

      if (imports.length === 0) {
        // This will load the original initilizer
        onDone(module, scope, moduleContent);
      }
    }
  };

  System.prototype.load = function (module, onDone) {
    var _this = this;
    module.id = module.id || 'noid-' + (new Date()).valueOf() + '-' + Math.round(performance.now());
    module.systemId = module.parentScope ? module.parentScope.systemId + '/' + module.id : module.id;

    Galaxy.onModuleLoaded[ module.systemId ] = onDone;
    var moduleExist = Galaxy.modules[ module.systemId ];

    var invokers = [ module.url ];
    if (module.invokers) {
      if (module.invokers.indexOf(module.url) !== -1) {
        throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
      }

      invokers = module.invokers;
      invokers.push(module.url);
    }

    if (moduleExist) {
      var ol = Galaxy.onModuleLoaded[ module.systemId ];
      if ('function' === typeof (ol)) {
        window.requestAnimationFrame(function () {
          ol.call(_this, moduleExist, moduleExist.scope.html);
          delete Galaxy.onModuleLoaded[ module.systemId ];
        });
      }

      return;
    }

    if (Galaxy.onLoadQueue[ module.systemId ]) {
      return;
    }

    Galaxy.onLoadQueue[ module.systemId ] = true;

    fetch(module.url + '?' + Galaxy.utility.serialize(module.params || {})).then(function (response) {
      var contentType = response.headers.get('content-type').split(';')[ 0 ] || 'text/html';
      response.text().then(function (htmlText) {
        var parsedContent = _this.parseModuleContent(module, htmlText, contentType);
        window.requestAnimationFrame(function () {
          _this.compileModuleContent(module, parsedContent, invokers, moduleLoaded);
        });
      });
    });

    function moduleLoaded (module, scope, filtered) {
      for (var item in importedLibraries) {
        if (importedLibraries.hasOwnProperty(item)) {
          var asset = importedLibraries[ item ];
          if (asset.module) {
            scope.imports[ asset.name ] = asset.module;
          }
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

      module.scope = scope;

      var componentScript = new Function('Scope', currentComponentScripts);
      componentScript.call(null, scope);

      module.scopeServices.forEach(function (item) {
        item.post();
      });

      delete module.scopeServices;

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

      var currentModule = Galaxy.modules[ module.systemId ];
      if (module.temporary || scope._doNotRegister) {
        delete scope._doNotRegister;
        currentModule = {
          id: module.id,
          scope: scope
        };
      } else if (!currentModule) {
        // currentModule = new Galaxy.GalaxyModule(module, scope);
        // Galaxy.modules[ module.systemId ] = currentModule;
        // Galaxy.modules[ module.systemId ] = {
        //   id: module.id,
        //   systemId: module.systemId,
        //   url: module.url,
        //   scope: scope
        //   // services: module.services
        // };
      }

      if ('function' === typeof (Galaxy.onModuleLoaded[ module.systemId ])) {
        Galaxy.onModuleLoaded[ module.systemId ].call(this, currentModule, scope.html);
        delete Galaxy.onModuleLoaded[ module.systemId ];
      }

      delete Galaxy.onLoadQueue[ module.systemId ];
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

    bootModule.domain = this;
    bootModule.id = 'system';

    _this.load(bootModule, function (module) {
      onDone.call(null, module);
      _this.start();
    });
  };

}(this));

