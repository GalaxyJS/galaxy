/* global Galaxy */

(function () {
  /**
   *
   * @returns {Galaxy.GalaxyStateHandler}
   */
  Galaxy.GalaxyStateHandler = GalaxyStateHandler;

  function GalaxyStateHandler (module) {
    this.module = module;
    this.id = module.id;
    this.systemId = module.systemId;
    this.domain = module.domain;
    this.inited = false;
    this.started = false;
    this.active = false;
    this.newListenerAdded = false;
    this.stateKey = '#';
    this.navigation = {};
    this.params = {};
    this.hashListeners = [];
    this.globalHashListeners = [];
    this.data = {};
    this.html = '';
    this.oldHash = '';

    // Life cycle
    this.onInit = null;
    this.onStart = null;
    this.onStop = null;

    this.module.registerAddOn('galaxy/scope-state', this);
  }

  GalaxyStateHandler.prototype.onModuleStart = function () {
    this.start();
  };

  GalaxyStateHandler.prototype.init = function () {
    this.inited = true;
    this.trigger('onInit');
  };

  GalaxyStateHandler.prototype.start = function () {
    this.started = true;
    this.active = true;
    this.trigger('onStart');
    //this.triggerEvent('start');
    // if (('system/' + this.domain.app.params[this.stateKey]).indexOf(this.id) <= -1) {
    //   console.log(this.domain.app.params[this.stateKey]);
    //   throw new Error('Could not find module `' + this.id + '` by state key `' + this.stateKey + '`');
    // }
    var newNav = Galaxy.utility.extend(true, {}, this.domain.app.navigation);
    var st = 'system/' + this.domain.app.params[ this.stateKey ];
    var napPath = st.indexOf(this.systemId) === 0 ? st.substr(this.systemId.length).split('/').filter(Boolean) : [];

    newNav[ this.stateKey ] = napPath;
    var params = this.domain.app.params;
    this.navigation = {};
    this.params = {};
    // Empty navigation and params before call the hashChanged method at the starting phase.
    // This will force the module to call all its event handlers
    //console.log("Module started: " + this.id, n, p);

    // This code is commented because its bug prone
    // hashChanged should be called only when the module params are inited with valid data
    // in other word start should be called after hashChanged
    // this.hashChanged(newNav, params, this.hash, this.domain.getHashNav(this.stateKey));

    var index = this.domain.notYetStarted.indexOf(this.systemId);
    if (index > -1) {
      this.domain.notYetStarted.splice(index, 1);
    }
    this.domain.app.newListenerAdded = true;
  };

  GalaxyStateHandler.prototype.dispose = function () {
  };

  /** Register an state handler with the specified id
   *
   * @param {String} id
   * @param {Function} handler
   */
  GalaxyStateHandler.prototype.on = function (id, handler) {
    this.hashListeners.push({ id: id, handler: handler });
    this.newListenerAdded = true;
  };

  /** Register an state handler globaly with the specified id.
   * Global state handlers will be called even if the mudole is not active
   *
   * @param {String} id
   * @param {Function} handler
   */
  GalaxyStateHandler.prototype.onGlobal = function (id, handler) {
    this.globalHashListeners.push({ id: id, handler: handler });
  };

  GalaxyStateHandler.prototype.getNav = function (key) {
    return this.domain.getHashNav(key);
  };

  GalaxyStateHandler.prototype.setNav = function (value, key) {
    var pathKey = key || '#';
    var pathValue = value === null || value === undefined ? '' : value;

    this.setParam(pathKey, (this.systemId + '/').replace('system/', '') + pathValue);
  };

  GalaxyStateHandler.prototype.getParam = function (key) {
    return this.domain.getHashParam(key);
  };

  /**
   *
   * @param {string} key Name of the parameter
   * @param {string} value Value of the parameter
   * @param {boolean} replace
   */
  GalaxyStateHandler.prototype.setParam = function (key, value, replace) {
    var paramObject = {};
    paramObject[ key ] = value;
    this.domain.setHashParameters(paramObject, replace);
  };

  /** Set value for param if the parameter does not exist in hash
   *
   * @param {String} param
   * @param {String} value
   * @returns {undefined}
   */
  GalaxyStateHandler.prototype.setParamIfNull = function (param, value) {
    if (!this.domain.getHashParam(param)) {
      var paramObject = {};
      paramObject[ param ] = value;
      this.domain.setHashParameters(paramObject, true);
    }
  };

  /** Set value for param if the current value of param is not equal to the passed value
   *
   * @param {staring} param
   * @param {staring} value
   * @returns {undefined}
   */
  GalaxyStateHandler.prototype.setParamIfNot = function (param, value) {
    if (this.domain.getHashParam(param) !== value) {
      var paramObject = {};
      paramObject[ param ] = value;
      this.domain.setHashParameters(paramObject, true);
    }
  };

  /**
   * Call the event function if exist and pass the args to it
   *
   * @param {String} event
   * @param {Array} args
   * @returns {undefined}
   */
  GalaxyStateHandler.prototype.trigger = function (event, args) {
    if (typeof (this[ event ]) === 'function') {
      this[ event ].apply(this, args);
    }
  };

  GalaxyStateHandler.prototype.hashChanged = function (navigation, params, hashValue, fullNav) {
    var _this = this;
    if (_this.started === false) {
      return;
    }

    var moduleNavigation = navigation;
    var fullNavPath = params[ _this.stateKey ];

    for (var id in this.domain.modules) {
      var module = this.domain.modules[ id ];
      var service = module.addOns[ 'galaxy/scope-state' ] || {};
      if (('system/' + fullNavPath).indexOf(module.systemId) !== 0 &&
        service.active) {
        service.trigger('onStop');
        service.active = false;
      }
      else if (module.systemId === 'system/' + fullNavPath && service.active) {
        this.domain.app.activeModule = service;
      }
    }

    this.hashHandler.call(this, navigation, params);
    var allNavigation = Galaxy.utility.extend({}, this.navigation, navigation);

    var tempNav = _this.navigation;

    _this.navigation = navigation;
    _this.params = params;

    if (this.domain.app.activeModule && this.active && this.domain.app.activeModule.systemId === _this.systemId) {
      for (var id in allNavigation) {
        if (allNavigation.hasOwnProperty(id)) {
          var stateHandlers = _this.hashListeners.filter(function (item) {
            return item.id === id;
          });

          if (stateHandlers.length) {
            if (tempNav[ id ]) {
              var currentKeyValue = tempNav[ id ].join('/');
              if (navigation[ id ] && currentKeyValue === navigation[ id ].join('/')) {
                continue;
              }
            }

            var parameters = [];
            parameters.push(null);
            var navigationValue = navigation[ id ];
            if (navigationValue) {
              parameters[ 0 ] = navigationValue.join('/');
              for (var i = 0; i < navigationValue.length; i++) {
                var arg = Galaxy.utility.isNumber(navigationValue[ i ]) ?
                  parseFloat(navigationValue[ i ]) :
                  navigationValue[ i ];

                parameters.push(arg);
              }
            }

            stateHandlers.forEach(function (item) {
              item.handler.apply(_this, parameters);
            });
          }
        }
      }
    } else if (this.active) {
      var keyStateHandlers = _this.hashListeners.filter(function (item) {
        return item.id === _this.stateKey;
      });

      var stateKeyNavigationValue = navigation[ _this.stateKey ];

      //if navHandler is null call sub module navHandler
      if (keyStateHandlers.length && stateKeyNavigationValue) {
        var currentKeyValue = tempNav[ _this.stateKey ] ? tempNav[ _this.stateKey ].join('/') : [];

        if (currentKeyValue !== stateKeyNavigationValue.join('/')) {
          var args = [];
          args.push(stateKeyNavigationValue);

          for (var i = 0, len = stateKeyNavigationValue.length; i < len; ++i) {
            //i is always valid index in the arguments object
            args.push(stateKeyNavigationValue[ i ]);
          }

          keyStateHandlers.forEach(function (item) {
            item.handler.apply(_this, args);
          });
        }
      }
      this.domain.app.activeModule = null;
    }

    for (var id in allNavigation) {
      if (allNavigation.hasOwnProperty(id)) {
        var globalStateHandlers = _this.globalHashListeners.filter(function (item) {
          return item.id === id;
        });

        if (globalStateHandlers.length) {
          if (tempNav[ id ]) {
            var currentKeyValue = tempNav[ id ].join('/');
            if (navigation[ id ] && currentKeyValue === navigation[ id ].join('/')) {
              continue;
            }
          }

          parameters = [];
          parameters.push(null);

          navigationValue = navigation[ id ];
          if (navigationValue) {
            parameters[ 0 ] = navigationValue.join('/');
            for (var i = 0; i < navigationValue.length; i++) {
              var arg = Galaxy.utility.isNumber(navigationValue[ i ]) ?
                parseFloat(navigationValue[ i ]) :
                navigationValue[ i ];

              parameters.push(arg);
            }
          }

          globalStateHandlers.forEach(function (item) {
            item.handler.apply(_this, parameters);
          });
        }
      }
    }

    if (!this.domain.app.activeModule && navigation[ _this.stateKey ] && navigation[ _this.stateKey ].length) {
      var path = 'system';
      for (var i = 0, len = navigation[ _this.stateKey ].length; i < len; i++) {
        path += '/' + navigation[ _this.stateKey ][ i ];
        if (_this.domain.modules[ path ] && _this.domain.modules[ path ].addOns[ 'galaxy/scope-state' ]) {
          _this.domain.app.activeModule = _this.domain.modules[ path ].addOns[ 'galaxy/scope-state' ];
          _this.domain.app.activeModule.active = true;
          moduleNavigation = Galaxy.utility.extend(true, {}, navigation);
          moduleNavigation[ _this.stateKey ] = fullNav.slice(_this.domain.app.activeModule.systemId.split('/').length -
            1);
          // Call module level events handlers
          _this.domain.app.activeModule.hashChanged(moduleNavigation, this.params, hashValue, fullNav);
        }
      }
    } else if (this.domain.app.activeModule &&
      this.domain.app.activeModule.systemId === this.systemId + '/' + navigation[ this.stateKey ][ 0 ]) {
      moduleNavigation = Galaxy.utility.extend(true, {}, navigation);
      moduleNavigation[ _this.stateKey ] = fullNav.slice(_this.domain.app.activeModule.systemId.split('/').length - 1);
      // Call module level events handlers
      _this.domain.app.activeModule.hashChanged(moduleNavigation, this.params, hashValue, fullNav);
    }
  };

  GalaxyStateHandler.prototype.loadModule = function (module, onDone) {
    Galaxy.loadModule(module, onDone, this.scope);
  };

  GalaxyStateHandler.prototype.hashHandler = function (nav, params) {
  };

})();
