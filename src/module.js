/* global Galaxy */

(function () {
  /** 
   *  
   * @returns {Galaxy.GalaxyModule}
   */
  Galaxy.GalaxyModule = GalaxyModule;
  Galaxy.module = new Galaxy.GalaxyModule();

  function GalaxyModule() {
    this.domain = null;
    this.inited = false;
    this.started = false;
    this.active = false;
    this.stateKey = '#';
    this.navigation = {};
    this.params = {};
    this.html = '';
    this.installModules = [];
    this.binds = {};
    this.newListenerAdded = false;
    this.onInit = null;
    this.onStart = null;
    this.onStop = null;
    this.hashListeners = [];
    this.globalHashListeners = [];
    this.data = {};
  }

  GalaxyModule.prototype.installModulesOnInit = function (modules) {
    this.installModules = modules;
  };

  GalaxyModule.prototype.init = function (navigations, params, html) {
    var _this = this;
    this.inited = true;
    this.trigger('onInit');

    this.installModules.forEach(function (lib) {
      _this.domain.loadModule(lib);
    });
  };

  GalaxyModule.prototype.start = function () {
    this.started = true;
    this.active = true;
    this.trigger('onStart');
    //this.triggerEvent('start');
    if (('system/' + this.domain.app.params[this.stateKey]).indexOf(this.id) <= -1) {
      console.log(this.domain.app.params[this.stateKey]);
      throw new Error('Could not find module `' + this.id + '` by state key `' + this.stateKey + '`');
    }
    var newNav = Galaxy.utility.extend(true, {}, this.domain.app.navigation);
    var st = 'system/' + this.domain.app.params[this.stateKey];
    var napPath = st.indexOf(this.id) === 0 ? st.substr(this.id.length).split('/').filter(Boolean) : [];

    newNav[this.stateKey] = napPath;
    var nav = newNav;
    var params = this.domain.app.params;
    this.navigation = {};
    this.params = {};
    // Empty navigation and params before call the hashChanged method at the starting phase.
    // This will force the module to call all its event handlers
    //console.log("Module started: " + this.id, n, p);

    // This code is commented because its bug prone
    // hashChanged should be called only when the module params are inited with valid data
    // in other word start should be called after hashChanged
    this.hashChanged(nav, params, this.hash, this.domain.getHashNav(this.stateKey));

    var index = this.domain.notYetStarted.indexOf(this.id);
    if (index > -1) {
      this.domain.notYetStarted.splice(index, 1);
    }
  };

  GalaxyModule.prototype.dispose = function () { };

  /** Register an state hanlder with the specified id
   * 
   * @param {String} id
   * @param {Function} handler
   */
  GalaxyModule.prototype.on = function (id, handler) {
    this.hashListeners.push({id: id, handler: handler});
    this.newListenerAdded = true;
  };

  /** Register an state handler globaly with the specified id.
   * Global state handlers will be called even if the mudole is not active
   * 
   * @param {String} id
   * @param {Function} handler
   */
  GalaxyModule.prototype.onGlobal = function (id, handler) {
    this.globalHashListeners.push({id: id, handler: handler});
  };

  GalaxyModule.prototype.getNav = function (key) {
    return this.domain.getHashNav(key);
  };

  GalaxyModule.prototype.setNav = function (value, key) {
    var pathKey = key || '#';
    var pathValue = value === null || value === undefined ? '' : value;

    this.setParam(pathKey, (this.id + '/').replace('system/', '') + pathValue);
  };

  GalaxyModule.prototype.getParam = function (key) {
    return this.domain.getHashParam(key);
  };

  /**
   * 
   * @param {string} key Name of the parameter
   * @param {string} value Value of the parameter
   * @param {boolean} replace
   */
  GalaxyModule.prototype.setParam = function (key, value, replace) {
    var paramObject = {};
    paramObject[key] = value;
    this.domain.setHashParameters(paramObject, replace);
  };

  /** Set value for param if the parameter does not exist in hash
   * 
   * @param {String} param
   * @param {String} value
   * @returns {undefined}
   */
  GalaxyModule.prototype.setParamIfNull = function (param, value) {
    if (!this.domain.getHashParam(param)) {
      var paramObject = {};
      paramObject[param] = value;
      this.domain.setHashParameters(paramObject, true);
    }
  };

  /** Set value for param if the current value of param is not equal to the passed value
   * 
   * @param {staring} param
   * @param {staring} value
   * @returns {undefined}
   */
  GalaxyModule.prototype.setParamIfNot = function (param, value) {
    if (this.domain.getHashParam(param) !== value) {
      var paramObject = {};
      paramObject[param] = value;
      this.domain.setHashParameters(paramObject, true);
    }
  };

  /**
   * 
   * @param {string} event name of module internal event
   * @param {function} action the action that bind one to one to the specified event
   * @returns {void}
   */
  GalaxyModule.prototype.bind = function (event, action) {
    if ('string' === typeof (event) && 'function' === typeof (action)) {
      this.binds[event] = action;
    }
  };

  GalaxyModule.prototype.stage = function (event, action) {
    if ('string' === typeof (event) && 'function' === typeof (action)) {
      this.binds[event] = action;
    }
  };

  /**
   * Call the event function if exist and pass the args to it
   * 
   * @param {String} event
   * @param {Array} args
   * @returns {undefined}
   */
  GalaxyModule.prototype.trigger = function (event, args) {
    if (typeof (this[event]) === 'function') {
      this[event].apply(this, args);
    }
  };

  GalaxyModule.prototype.hashChanged = function (navigation, params, hashValue, fullNav) {
    var _this = this;
    var moduleNavigation = navigation;
    var fullNavPath = params[_this.stateKey];

    for (var id in this.domain.modules) {
      var module = this.domain.modules[id];
      if (module.id !== 'system/' + fullNavPath && module.active) {
        module.trigger('onStop');
        module.active = false;
      } else if (module.id === 'system/' + fullNavPath && module.active) {
        this.domain.app.activeModule = module;
      }
    }
//    console.log(this.id);

    this.hashHandler.call(this, navigation, params);
    var allNavigations = Galaxy.utility.extend({}, this.navigation, navigation);

    var tempNav = _this.navigation;

    _this.navigation = navigation;
    _this.params = params;

    if (this.domain.app.activeModule && this.active && this.domain.app.activeModule.id === _this.id) {
      for (var id in allNavigations) {
        if (allNavigations.hasOwnProperty(id)) {
          var stateHandlers = _this.hashListeners.filter(function (item) {
            return item.id === id;
          });

          if (stateHandlers.length) {
            if (tempNav[id]) {
              var currentKeyValue = tempNav[id].join('/');
              if (navigation[id] && currentKeyValue === navigation[id].join('/')) {
                continue;
              }
            }

            var parameters = [];
            parameters.push(null);
            var navigationValue = navigation[id];
            if (navigationValue) {
              parameters[0] = navigationValue.join('/');
              for (var i = 0; i < navigationValue.length; i++) {
                var arg = Galaxy.utility.isNumber(navigationValue[i]) ? parseFloat(navigationValue[i]) : navigationValue[i];

                parameters.push(arg);
              }
            }

            stateHandlers.forEach(function (item) {
              item.handler.apply(_this, parameters);
            });
          }
        }
      }
    } else if (!this.active) {
      var keyStateHandlers = _this.hashListeners.filter(function (item) {
        return item.id === _this.stateKey;
      });

      var stateKeyNavigationValue = navigation[_this.stateKey];

      //if navHandler is null call sub module navHandler
      if (keyStateHandlers.length && stateKeyNavigationValue) {
        var currentKeyValue = tempNav[_this.stateKey] ? tempNav[_this.stateKey].join('/') : [];

        if (currentKeyValue !== stateKeyNavigationValue.join('/')) {
          var args = [];
          args.push(stateKeyNavigationValue);

          for (var i = 0, len = stateKeyNavigationValue.length; i < len; ++i) {
            //i is always valid index in the arguments object
            args.push(stateKeyNavigationValue[i]);
          }

          keyStateHandlers.forEach(function (item) {
            item.handler.apply(_this, args);
          });
        }
      }
    }

    for (var id in allNavigations) {
      if (allNavigations.hasOwnProperty(id)) {
        var globalStateHandlers = _this.globalHashListeners.filter(function (item) {
          return item.id === id;
        });

        if (globalStateHandlers.length) {
          if (tempNav[id]) {
            var currentKeyValue = tempNav[id].join('/');
            if (navigation[id] && currentKeyValue === navigation[id].join('/')) {
              continue;
            }
          }

          parameters = [];
          parameters.push(null);

          navigationValue = navigation[id];
          if (navigationValue) {
            parameters[0] = navigationValue.join('/');
            for (var i = 0; i < navigationValue.length; i++) {
              var arg = Galaxy.utility.isNumber(navigationValue[i]) ? parseFloat(navigationValue[i]) : navigationValue[i];

              parameters.push(arg);
            }
          }

          globalStateHandlers.forEach(function (item) {
            item.handler.apply(_this, parameters);
          });
        }
      }
    }

    // Set the app.activeModule according to the current navigation path
    if (navigation[this.stateKey] && this.domain.modules[this.id + '/' + navigation[this.stateKey][0]]) {
      this.domain.app.activeModule = this.domain.modules[this.id + '/' + navigation[this.stateKey][0]];
    }

    if (this.domain.app.activeModule && this.domain.app.activeModule.id === this.id + '/' + navigation[this.stateKey][0]) {
      // Remove first part of navigation in order to force activeModule to only react to events at its level and higher 
      moduleNavigation = Galaxy.utility.extend(true, {}, navigation);
      moduleNavigation[this.stateKey] = fullNav.slice(this.domain.app.activeModule.id.split('/').length - 1);
      // Call module level events handlers
      this.domain.app.activeModule.hashChanged(moduleNavigation, this.params, hashValue, fullNav);
    }
  };

  GalaxyModule.prototype.loadModule = function (module, onDone) {
    Galaxy.loadModule(module, onDone, this.scope);
  };

  GalaxyModule.prototype.hashHandler = function (nav, params) {};

})();