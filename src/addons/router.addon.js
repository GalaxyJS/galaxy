(function (G) {
  'use strict';

  SimpleRouter.PARAMETER_REGEXP = /([:*])(\w+)/g;
  SimpleRouter.WILDCARD_REGEXP = /\*/g;
  SimpleRouter.REPLACE_VARIABLE_REGEXP = '([^\/]+)';
  SimpleRouter.REPLACE_WILDCARD = '(?:.*)';
  SimpleRouter.FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';
  SimpleRouter.MATCH_REGEXP_FLAGS = '';

  const _typeof = typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol'
    ? function (obj) { return typeof obj; }
    : function (obj) {
      return obj && typeof Symbol === 'function' && obj.constructor === Symbol && obj !== Symbol.prototype
        ? 'symbol'
        : typeof obj;
    };

  function isPushStateAvailable() {
    return !!(typeof window !== 'undefined' && window.history && window.history.pushState);
  }

  function clean(s) {
    if (s instanceof RegExp) {
      return s;
    }
    return s.replace(/\/+$/, '').replace(/^\/+/, '^/');
  }

  function regExpResultToParams(match, names) {
    if (names.length === 0) {
      return null;
    }

    if (!match) {
      return null;
    }

    return match.slice(1, match.length).reduce(function (params, value, index) {
      if (params === null) {
        params = {};
      }
      params[names[index]] = decodeURIComponent(value);
      return params;
    }, null);
  }

  function replaceDynamicURLParts(route) {
    const paramNames = [];
    let regexp;

    if (route instanceof RegExp) {
      regexp = route;
    } else {
      regexp = new RegExp(route.replace(SimpleRouter.PARAMETER_REGEXP,
        function (full, dots, name) {
          paramNames.push(name);
          return SimpleRouter.REPLACE_VARIABLE_REGEXP;
        }).replace(SimpleRouter.WILDCARD_REGEXP, SimpleRouter.REPLACE_WILDCARD) +
        SimpleRouter.FOLLOWED_BY_SLASH_REGEXP, SimpleRouter.MATCH_REGEXP_FLAGS);
    }

    return {
      regexp: regexp,
      paramNames: paramNames
    };
  }

  function getUrlDepth(url) {
    return url.replace(/\/$/, '').split('/').length;
  }

  function compareUrlDepth(urlA, urlB) {
    return getUrlDepth(urlB) - getUrlDepth(urlA);
  }

  function findMatchedRoutes(url) {
    const routes = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    return routes.map(function (route) {
      const _replaceDynamicURLPar = replaceDynamicURLParts(clean(route.route)),
        regexp = _replaceDynamicURLPar.regexp,
        paramNames = _replaceDynamicURLPar.paramNames;

      const match = url.replace(/^\/+/, '/').match(regexp);
      const params = regExpResultToParams(match, paramNames);

      if (route.route === '/' && match.input !== '/') {
        return { match: match, route: route, params: params };
      }

      return match ? { match: match, route: route, params: params } : false;
    }).filter(function (m) {
      return m;
    });
  }

  function match(url, routes) {
    return findMatchedRoutes(url, routes)[0] || false;
  }

  function root(url, routes) {
    const matched = routes.map(function (route) {
      return route.route === '/' || route.route === '*' ? url : url.split(new RegExp(route.route + '($|\/)'))[0];
    });
    const fallbackURL = clean(url);

    if (matched.length > 1) {
      return matched.reduce(function (result, url) {
        if (result.length > url.length) {
          result = url;
        }
        return result;
      }, matched[0]);
    } else if (matched.length === 1) {
      return matched[0];
    }

    return fallbackURL;
  }

  function isHashChangeAPIAvailable() {
    return typeof window !== 'undefined' && 'onhashchange' in window;
  }

  function extractGETParameters(url) {
    return url.split(/\?(.*)?$/).slice(1).join('');
  }

  function getOnlyURL(url, useHash, hash) {
    let onlyURL = url,
      split;
    const cleanGETParam = function cleanGETParam(str) {
      return str.split(/\?(.*)?$/)[0];
    };

    if (typeof hash === 'undefined') {
      // To preserve BC
      hash = '#';
    }

    if (isPushStateAvailable() && !useHash) {
      onlyURL = cleanGETParam(url).split(hash)[0];
    } else {
      split = url.split(hash);
      onlyURL = split.length > 1 ? cleanGETParam(split[1]) : cleanGETParam(split[0]);
    }

    return onlyURL.replace(/\/+$/, '').replace(/\/\//, '/') || '/';
  }

  function manageHooks(handler, hooks, params) {
    if (hooks && (typeof hooks === 'undefined' ? 'undefined' : _typeof(hooks)) === 'object') {
      if (hooks.before) {
        hooks.before(function () {
          const shouldRoute = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

          if (!shouldRoute) {
            return;
          }
          handler();
          hooks.after && hooks.after(params);
        }, params);
        return;
      } else if (hooks.after) {
        handler();
        hooks.after && hooks.after(params);
        return;
      }
    }
    handler();
  }

  function isHashedRoot(url, useHash, hash) {
    if (isPushStateAvailable() && !useHash) {
      return false;
    }

    if (!url.match(hash)) {
      return false;
    }

    const split = url.split(hash);

    return split.length < 2 || split[1] === '';
  }

  function SimpleRouter(r, useHash, hash) {
    const _this = this;

    _this.root = null;
    _this._routes = [];
    _this._useHash = useHash;
    _this._hash = typeof hash === 'undefined' ? '#' : hash;
    _this._paused = false;
    _this._destroyed = false;
    _this._lastRouteResolved = null;
    _this._notFoundHandler = null;
    _this._defaultHandler = null;
    _this._usePushState = !useHash && isPushStateAvailable();
    _this._onLocationChange = function () {
      _this.resolve();
    };
    _this._genericHooks = null;
    _this._historyAPIUpdateMethod = 'pushState';

    if (r) {
      _this.root = useHash ? r.replace(/\/$/, '/' + _this._hash) : r.replace(/\/$/, '');
    } else if (useHash) {
      _this.root = _this._cLoc().split(_this._hash)[0].replace(/\/$/, '/' + _this._hash);
    }

    _this._listen();
  }

  SimpleRouter.prototype = {
    helpers: {
      match: match,
      root: root,
      clean: clean,
      getOnlyURL: getOnlyURL
    },

    navigate: function navigate(path, absolute) {
      let to;

      path = path || '';
      if (this._usePushState) {
        to = (!absolute ? this._getRoot() + '/' : '') + path.replace(/^\/+/, '/');
        to = to.replace(/([^:])(\/{2,})/g, '$1/');
        history[this._historyAPIUpdateMethod]({}, '', to);
        this.resolve();
      } else if (typeof window !== 'undefined') {
        path = path.replace(new RegExp('^' + this._hash), '');
        if (path[0] !== '/') {
          path = '/' + path;
        }
        window.location.href = window.location.href.replace(/#$/, '').replace(new RegExp(this._hash + '.*$'), '') + this._hash + path;
      }
      return this;
    },

    navigateFromHere: function navigate(path) {
      path = path.replace(new RegExp('^' + this._hash), '');
      if (path[0] !== '/') {
        path = '/' + path;
      }
      const to = (this.root + path).replace('/' + this._hash, '');

      return this.navigate(to);
    },

    on: function on() {
      const _this = this;
      let _len = arguments.length;
      const args = new Array(_len);

      for (let key = 0; key < _len; key++) {
        args[key] = arguments[key];
      }

      if (typeof args[0] === 'function') {
        _this._defaultHandler = { handler: args[0], hooks: args[1] };
      } else if (args.length >= 2) {
        _this._add(args[0], args[1], args[2]);
      }

      return this;
    },

    off: function off(handler) {
      if (this._defaultHandler !== null && handler === this._defaultHandler.handler) {
        this._defaultHandler = null;
      } else if (this._notFoundHandler !== null && handler === this._notFoundHandler.handler) {
        this._notFoundHandler = null;
      }
      this._routes = this._routes.reduce(function (result, r) {
        if (r.handler !== handler) {
          result.push(r);
        }
        return result;
      }, []);
      return this;
    },

    notFound: function notFound(handler, hooks) {
      this._notFoundHandler = { handler: handler, hooks: hooks };
      return this;
    },

    resolve: function resolve(current) {
      const _this = this;

      let handler, m;
      let url = (current || this._cLoc()).replace(this._getRoot(), '');

      if (this._useHash) {
        url = url.replace(new RegExp('^\/' + this._hash), '/');
      }

      const GETParameters = extractGETParameters(current || this._cLoc());
      const onlyURL = getOnlyURL(url, this._useHash, this._hash);

      if (this._paused) {
        return false;
      }

      if (this._lastRouteResolved && onlyURL === this._lastRouteResolved.url && GETParameters === this._lastRouteResolved.query) {
        if (this._lastRouteResolved.hooks && this._lastRouteResolved.hooks.already) {
          this._lastRouteResolved.hooks.already(this._lastRouteResolved.params);
        }
        return false;
      }

      m = match(onlyURL, this._routes);

      if (window.location.hash.indexOf(this.root.replace(/^\/*/, '')) !== 0) {
        debugger;
        // return false;
      }

      if (m) {
        this._callLeave();
        this._lastRouteResolved = {
          url: onlyURL,
          query: GETParameters,
          hooks: m.route.hooks,
          params: m.params,
          name: m.route.name
        };
        handler = m.route.handler;
        manageHooks(function () {
          manageHooks(function () {
            m.route.route instanceof RegExp ? handler.apply(undefined, m.match.slice(1, m.match.length)) : handler(m.params, GETParameters);
          }, m.route.hooks, m.params, _this._genericHooks);
        }, this._genericHooks, m.params);
        return m;
      } else if (this._defaultHandler &&
        (onlyURL === '' || onlyURL === '/' || onlyURL === this._hash || isHashedRoot(onlyURL, this._useHash, this._hash))) {
        manageHooks(function () {
          manageHooks(function () {
            _this._callLeave();
            _this._lastRouteResolved = { url: onlyURL, query: GETParameters, hooks: _this._defaultHandler.hooks };
            _this._defaultHandler.handler(GETParameters);
          }, _this._defaultHandler.hooks);
        }, this._genericHooks);
        return true;
      } else if (this._notFoundHandler) {
        manageHooks(function () {
          manageHooks(function () {
            _this._callLeave();
            _this._lastRouteResolved = { url: onlyURL, query: GETParameters, hooks: _this._notFoundHandler.hooks };
            _this._notFoundHandler.handler(GETParameters);
          }, _this._notFoundHandler.hooks);
        }, this._genericHooks);
      }
      return false;
    },

    destroy: function destroy() {
      this._routes = [];
      this._destroyed = true;
      this._lastRouteResolved = null;
      this._genericHooks = null;
      clearTimeout(this._listeningInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', this._onLocationChange);
        window.removeEventListener('hashchange', this._onLocationChange);
      }
    },

    link: function link(path) {
      return this._getRoot() + path;
    },

    pause: function pause() {
      const status = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

      this._paused = status;
      if (status) {
        this._historyAPIUpdateMethod = 'replaceState';
      } else {
        this._historyAPIUpdateMethod = 'pushState';
      }
    },

    resume: function resume() {
      this.pause(false);
    },

    lastRouteResolved: function lastRouteResolved() {
      return this._lastRouteResolved;
    },

    hooks: function hooks(_hooks) {
      this._genericHooks = _hooks;
    },

    init: function (routes) {
      const _this = this;
      const orderedRoutes = Object.keys(routes).sort(compareUrlDepth);
      orderedRoutes.forEach(function (route) {
        _this.on(route, routes[route]);
      });

      _this.resolve();
      return _this;
    },

    _add: function _add(route) {
      const handler = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      const hooks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

      if (typeof route === 'string') {
        route = encodeURI(route);
      }
      this._routes.push((typeof handler === 'undefined' ? 'undefined' : _typeof(handler)) === 'object' ? {
        route: route,
        handler: handler.uses,
        name: handler.as,
        hooks: hooks || handler.hooks
      } : { route: route, handler: handler, hooks: hooks });

      return this._add;
    },

    _getRoot: function _getRoot() {
      if (this.root !== null) {
        return window.location.origin + this.root;
      }

      this.root = root(this._cLoc().split('?')[0], this._routes);
      return this.root;
    },

    _listen: function _listen() {
      const _this = this;
      // use popstate for modern browsers
      if (_this._usePushState) {
        window.addEventListener('popstate', _this._onLocationChange);
      } else if (isHashChangeAPIAvailable()) {
        window.addEventListener('hashchange', _this._onLocationChange);
      }
      // fallback for very old browser which don't support both hashchange and popstate
      else {
        let cached = _this._cLoc();
        let current = void 0;

        const _check = function check() {
          current = _this._cLoc();
          if (cached !== current) {
            cached = current;
            _this.resolve();
          }
          _this._listeningInterval = setTimeout(_check, 50);
        };

        _check();
      }
    },

    _cLoc: function _cLoc() {
      if (typeof window !== 'undefined') {
        if (typeof window.__NAVIGO_WINDOW_LOCATION_MOCK__ !== 'undefined') {
          return window.__NAVIGO_WINDOW_LOCATION_MOCK__;
        }
        return clean(window.location.href);
      }
      return '';
    },

    _callLeave: function _callLeave() {
      const lastRouteResolved = this._lastRouteResolved;

      if (lastRouteResolved && lastRouteResolved.hooks && lastRouteResolved.hooks.leave) {
        lastRouteResolved.hooks.leave(lastRouteResolved.params);
      }
    }
  };

  G.registerAddOnProvider('galaxy/router', function (scope, module) {
    return {
      create: function () {
        if (module.systemId === 'system') {
          return new SimpleRouter(window.location.hash, true, '#!');
        } else {
          debugger;
          const router = new SimpleRouter(window.location.hash + '/' + module.id, true, '#!');

          scope.on('module.destroy', function () {
            router.destroy();
          });

          return router;
        }
      },
      finalize: function () { }
    };
  });

})(Galaxy);
