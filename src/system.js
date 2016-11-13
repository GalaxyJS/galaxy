/* global Galaxy, nanoajax, Node */

(function () {
  Galaxy = new System();
  Galaxy.GalaxySystem = System;

  var entities = {};
  var importedLibraries = {};
  function System() {
    this.stateKey = 'app';
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
  }

  System.prototype.state = function (id, handler) {
    //return this.app.module(id, object, false);
    var module, modulePath, moduleNavigation;
    var domain = this;
    if (!domain) {
      throw "Domain can NOT be null";
    }
    id = this.app.id + '/' + id;

    //if forceReload is true, then init the module again
    if (!handler/* && this.modules[id]*/) {
      // Add the module to notYetStarted list so it can be started by startLastLoadedModule method
      domain.notYetStarted.push(id);
      return domain.modules[id];
    }

    if (domain.modules[id]) {
      return domain.modules[id];
    }

    if (typeof (handler) === "function") {
      module = Galaxy.utility.extend(true, {}, Galaxy.module.create());
      module.domain = domain;
      module.id = id;
      module.stateId = id.replace('system/', '');

      handler.call(null, module);
    } else {
      module = Galaxy.utility.extend(true, {}, Galaxy.module.create(), handler || {});
      module.domain = domain;
      module.id = id;
      module.stateId = id.replace('system/', '');
    }

    modulePath = domain.app.navigation[module.stateKey] ? domain.app.navigation[module.stateKey] : [];
    moduleNavigation = Galaxy.utility.extend(true, {}, domain.app.navigation);
    moduleNavigation[module.stateKey] = modulePath.slice(id.split("/").length - 1);

    domain.modules[id] = module;
    domain.notYetStarted.push(id);

    // Set module hash for this module when its inited
    // module hash will be set in the hashChanged method as well
    // if current navigation path is equal to this module id
    //module.hash = Galaxy.modulesHashes[id.replace("system/", "")] = module.stateKey + "=" + id.replace("system/", "");

    module.init(moduleNavigation, domain.app.params);

    return module;
  };

  System.prototype.component = function (scope, handler) {
    var app = this.getHashParam('app');

    if (app.indexOf(scope._stateId) === 0) {
      return this.state(scope._stateId, handler);
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
    var detect = function () {
      if (_this.app.oldHash !== window.location.hash/* || self.app.newHandler*/) {
        var hashValue = window.location.hash;
        var navigation = {};
        var params = {};

        hashValue = hashValue.replace(/^#\/?/igm, '');

        hashValue.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
          navigation[k] = v.split("/").filter(Boolean);
          params[k] = v;
        });

        _this.setModuleHashValue(navigation, params, hashValue);
        _this.app.hashChanged(navigation, params, hashValue, navigation[_this.app.stateKey]); // Galaxy
        _this.app.oldHash = '#' + hashValue;
      }
    };

    detect();
    clearInterval(this.hashChecker);
    this.hashChecker = setInterval(function () {
      detect();
    }, 50);
  };

  System.prototype.setModuleHashValue = function (navigation, parameters, hashValue, init) {
    var nav = parameters[this.stateKey];

    if (!nav) {
      return;
    }

    if (Galaxy.modulesHashes[nav] && Galaxy.app.activeModule !== Galaxy.modules["system/" + nav] && Galaxy.app.activeModule && Galaxy.app.activeModule.stateKey === 'app') {
      //window.location.hash = Galaxy.modulesHashes[nav];
      // When the navigation path is changed
      //alert(Galaxy.modulesHashes[nav] + " YES " + nav);
    } else if (!this.firstTime) {
      // first time indicates that the page is (re)loaded and the window.location.hash should be set
      // as the module hash value for the module which is specified by app parameter in the hash value.
      // Other modules get default hash value
      Galaxy.modulesHashes[nav] = hashValue;
      this.firstTime = true;
      //alert("first time: " + Galaxy.modulesHashes[nav] + " " + hashValue);
    } else if (!Galaxy.modulesHashes[nav]) {
      // When the module does not exist 
      Galaxy.modulesHashes[nav] = "app=" + nav;
      //alert(Galaxy.modulesHashes[nav] + " default hash");
    } else if (Galaxy.modulesHashes[nav]) {
      // When the hash parameters value is changed from the browser url bar or originated from url bar
      Galaxy.modulesHashes[nav] = hashValue;
    }
  };

  System.prototype.init = function (mods) {
    this.app = Galaxy.utility.extend(true, {}, Galaxy.module.create());
    this.app.domain = this;
    this.app.stateKey = this.stateKey;
    this.app.id = 'system';
    this.app.installModules = mods || [];
    this.app.init({}, {}, 'system');
  };

  System.prototype.parseContent = function (raw, module) {
    var scripts = [];
    var imports = [];
    if (!Galaxy.utility.isHTML(raw)) {
      console.log('Resource is not a valid html file:', module.url);

      return {
        html: [],
        imports: [],
        uiView: [],
        script: ''
      };
    }
    
    var raw = Galaxy.utility.parseHTML(raw);
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

//        if (e.tagName && e.tagName.toLowerCase() === 'link') {
//          return false;
//        }

      return true;
    });
    var templates = {};
    var temp = document.createElement('div');
    for (var i = 0, len = html.length; i < len; i++) {
      html[i] = temp.appendChild(html[i]);
    }
    document.getElementsByTagName('body')[0].appendChild(temp);
    var uiView = temp.querySelectorAll('system-ui-view,[system-ui-view]');
    temp.parentNode.removeChild(temp);

    return {
      html: html,
      imports: imports,
      uiView: uiView,
      script: scripts.join('\n')
    };
  };

  System.prototype.load = function (module, onDone) {
    module.id = module.id || (new Date()).valueOf() + '-' + performance.now();

    Galaxy.onModuleLoaded['system/' + module.id] = onDone;
    var moduleExist = Galaxy.modules['system/' + module.id];

    var invokers = [module.url];

    if (module.invokers) {
      if (module.invokers.indexOf(module.url) !== -1) {
        throw new Error('circular dependencies: \n' + module.invokers.join('\n') + '\nwanna load: ' + module.url);
      }

      invokers = module.invokers;
      invokers.push(module.url);
    }

    if (moduleExist) {
      //console.log('module exist: ', module.id);
      if ('function' === typeof (Galaxy.onModuleLoaded['system/' + module.id])) {
        Galaxy.onModuleLoaded['system/' + module.id].call(this, moduleExist, moduleExist.html);
        delete Galaxy.onModuleLoaded['system/' + module.id];
      }

      return;
    }

    if (Galaxy.onLoadQueue["system/" + module.id]) {
      return;
    }

    Galaxy.onLoadQueue["system/" + module.id] = true;

    nanoajax.ajax({
      method: 'GET',
      url: module.url,
      body: Galaxy.utility.serialize(module.params || {})
    }, function (code, response) {
      var parsedContent = Galaxy.parseContent(response, module);

      setTimeout(function () {
        compile(parsedContent);
      }, 1);
    });

    function compile(parsedContent) {
      var scopeUIViews = {};
      Array.prototype.forEach.call(parsedContent.uiView, function (item) {
        var uiViewName = item.getAttribute('system-ui-view') || item.getAttribute('name');
        var key = uiViewName.replace(/([A-Z])|(\-)|(\s)/g, function ($1) {
          return "_" + (/[A-Z]/.test($1) ? $1.toLowerCase() : '');
        });

        scopeUIViews[key] = item;
      });

      var scope = {
        _moduleId: 'system/' + module.id,
        _stateId: module.id,
        parentScope: module.scope || null,
        uiViews: scopeUIViews,
        ui: parsedContent.html,
        html: parsedContent.html,
        views: scopeUIViews,
        imports: {}
      };

//        console.log(parsedContent.imports);
      var imports = Array.prototype.slice.call(parsedContent.imports, 0);
      //var importsOfScope = {};
      var scriptContent = parsedContent.script || '';

      // extract imports from the source code
      scriptContent = scriptContent.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
      parsedContent.script = scriptContent.replace(/Scope\.import\(['|"](.*)['|"]\)\;/gm, function (match, path) {
        var query = path.match(/([\S]+)/gm);
        imports.push({
          url: query[query.length - 1],
          fresh: query.indexOf('new') !== -1
        });

        return "Scope.imports['" + query[query.length - 1] + "']";
      });

//       console.log('Libraries to be imported: ', JSON.stringify(imports));

      if (imports.length) {
        imports.forEach(function (item) {
          if (importedLibraries[item.url] && !item.fresh) {
            doneImporting(module, scope, imports, parsedContent);
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
              doneImporting(module, scope, imports, parsedContent);
            });
          }
        });

        return false;
      }

      moduleLoaded(module, scope, parsedContent);
    }

    function doneImporting(module, scope, imports, filtered) {
      imports.splice(imports.indexOf(module.url), 1);

      if (imports.length === 0) {
        // This will load the original initilizer
        moduleLoaded(module, scope, filtered);
      }
    }

    function moduleLoaded(module, scope, filtered) {
      for (var item in importedLibraries) {
        if (importedLibraries.hasOwnProperty(item)) {
          var asset = importedLibraries[item];
          scope.imports[asset.name] = asset.module;
        }
      }

      (new Function('Scope', filtered.script)).call(null, scope);

      if (!importedLibraries[module.url]) {
        importedLibraries[module.url] = {
          name: module.name || module.url,
          module: scope.export
        };
      } else if (module.fresh) {
        importedLibraries[module.url].module = scope.export;
      } else {
        scope.imports[module.name] = importedLibraries[module.url].module;
      }

//        delete scope.export;

      var currentModule = Galaxy.modules['system/' + module.id];

      if (module.temprory || scope._doNotRegister) {
//          console.log('do not register', module.id);
        delete scope._doNotRegister;
        currentModule = {};
      } else if (!currentModule) {
//          console.log('empty', module.id);
        currentModule = Galaxy.modules['system/' + module.id] = {};
      }

      currentModule.html = filtered.html;
      currentModule.scope = scope;

      if ('function' === typeof (Galaxy.onModuleLoaded['system/' + module.id])) {
        //console.log('immidiate load: ', currentModule, Galaxy.onModuleLoaded);
        Galaxy.onModuleLoaded['system/' + module.id].call(this, currentModule, currentModule.html);
        delete Galaxy.onModuleLoaded['system/' + module.id];
      }

      delete Galaxy.onLoadQueue['system/' + module.id];
    }
  };

  System.prototype.setURLHash = function (hash) {
    //var hash = hash;
    hash = hash.replace(/^#\/?/igm, '');

    var navigation = {};
    var params = {};
    hash.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
      navigation[k] = v.split("/").filter(Boolean);
      params[k] = v;
    });

  };

  System.prototype.getHashParam = function (key, hashName) {
    var asNumber = parseFloat(this.app.params[key]);
    return asNumber || this.app.params[key] || null;
  };

  System.prototype.getHashNav = function (key, hashName) {
    return this.app.navigation[key] || [
    ];
  };

  System.prototype.setModuleHashValue = function (navigation, parameters, hashValue, init) {
    var nav = parameters[this.stateKey];

    if (!nav) {
      return;
    }

    if (Galaxy.modulesHashes[nav] && Galaxy.app.activeModule !== Galaxy.modules["system/" + nav] && Galaxy.app.activeModule && Galaxy.app.activeModule.stateKey === 'app') {
      //window.location.hash = Galaxy.modulesHashes[nav];
      // When the navigation path is changed
      //alert(Galaxy.modulesHashes[nav] + " YES " + nav);
    } else if (!this.firstTime) {
      // first time indicates that the page is (re)loaded and the window.location.hash should be set
      // as the module hash value for the module which is specified by app parameter in the hash value.
      // Other modules get default hash value
      Galaxy.modulesHashes[nav] = hashValue;
      this.firstTime = true;
      //alert("first time: " + Galaxy.modulesHashes[nav] + " " + hashValue);
    } else if (!Galaxy.modulesHashes[nav]) {
      // When the module does not exist 
      Galaxy.modulesHashes[nav] = "app=" + nav;
      //alert(Galaxy.modulesHashes[nav] + " default hash");
    } else if (Galaxy.modulesHashes[nav]) {
      // When the hash parameters value is changed from the browser url bar or originated from url bar
      Galaxy.modulesHashes[nav] = hashValue;
    }
  };

  /** Set parameters for app/nav. if app/nav was not in parameters, then set paraters for current app/nav
   * 
   * @param {type} parameters
   * @param {type} replace if true it overwrites last url history otherwise it create new url history
   * @param {type} clean clean all the existing parameters
   * @returns {undefined}
   */
  System.prototype.setHashParameters = function (parameters, replace, clean) {
    var newParams = Galaxy.utility.clone(parameters);
    this.lastHashParams = parameters;
    var hashValue = window.location.hash;
    //var originHash = hashValue;
    var nav = parameters["app"];
    if (nav && !Galaxy.modulesHashes[nav]) {
      //console.log(hashValue, nav)
      Galaxy.modulesHashes[nav] = hashValue = "app=" + nav;

    } else if (nav && Galaxy.modulesHashes[nav]) {
      //console.log(hashValue, nav , Galaxy.modulesHashes[nav]);
      //alert("---------");
      hashValue = Galaxy.modulesHashes[nav];
    }
    //console.log(parameters, nav, Galaxy.modulesHashes[nav]);

    if (hashValue.indexOf("#") !== -1) {
      hashValue = hashValue.substring(1);
    }
    var pairs = hashValue.split("&");
    var newHash = "#";
    var and = false;

    hashValue.replace(/([^&]*)=([^&]*)/g, function (m, k, v) {
      if (newParams[k] !== null && typeof newParams[k] !== 'undefined') {
        newHash += k + "=" + newParams[k];
        newHash += '&';
        and = true;
        delete newParams[k];
      } else if (!newParams.hasOwnProperty(k) && !clean) {
        newHash += k + "=" + v;
        newHash += '&';
        and = true;
      }
    });
    // New keys
    for (var key in newParams) {
      if (newParams.hasOwnProperty(key)) {
        var value = newParams[key];

        if (key && value) {
          newHash += key + "=" + value + "&";
        }
      }
    }

    newHash = newHash.replace(/\&$/, '');

    if (replace) {
      window.location.replace(('' + window.location).split('#')[0] + newHash);
    } else {
      window.location.hash = newHash.replace(/\&$/, '');
    }
  };

  System.prototype.setParamIfNull = function (param, value) {
    this.app.setParamIfNull(param, value);
  };
  
  System.prototype.loadDependecies = function (dependecies) {
    for(var key in dependecies) {
      
    }
  };
}());

