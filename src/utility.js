/* global Galaxy */

(function (galaxy) {
  galaxy.utility = {
    clone: function (source) {
      if (null === source || 'object' !== typeof source)
        return source;
      var copy = source.constructor();
      for (var property in source) {
        if (source.hasOwnProperty(property)) {
          copy[ property ] = source[ property ];
        }
      }

      return copy;
    },
    extend: function (out) {
      var isDeep = false;
      //out = out || {};

      if (out === true) {
        isDeep = true;
        out = {};
      }

      for (var i = 1; i < arguments.length; i++) {
        var obj = arguments[ i ];

        if (!obj)
          continue;

        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[ key ] === 'object' && isDeep) {
              if (Array.isArray(obj[ key ])) {
                out[ key ] = galaxy.utility.extend([], obj[ key ]);
              } else {
                out[ key ] = galaxy.utility.extend({}, obj[ key ]);
              }
            } else {
              out[ key ] = obj[ key ];
            }
          }
        }
      }

      return out;
    },
    installModuleStateHandlers: function (module, states) {
      for (var state in states) {
        module.on(state, states[ state ]);
      }
    },
    getProperty: function (obj, propString) {
      if (!propString)
        return obj;

      var prop, props = propString.split('.');

      for (var i = 0, iLen = props.length - 1; i < iLen; i++) {
        prop = props[ i ];

        var candidate = obj[ prop ];
        if (candidate !== undefined) {
          obj = candidate;
        } else {
          break;
        }
      }

      return obj[ props[ i ] ];
    },
    isHTML: function (str) {
      var element = document.createElement('div');
      element.innerHTML = str;
      for (var c = element.childNodes, i = c.length; i--;) {
        if (c[ i ].nodeType === 1)
          return true;
      }
      return false;
    },
    decorate: function (hostObject) {
      return {
        'with': function (behavior) {
          Array.prototype.unshift.call(arguments, hostObject);
          return behavior.apply(null, arguments);
        }
      };
    },
    withHost: function (hostObject) {
      return {
        behave: function (behavior) {
          if (typeof behavior !== 'function') {
            throw 'Behavior is not a function: ' + behavior;
          }

          return function () {
            Array.prototype.unshift.call(arguments, hostObject);

            return behavior.apply(null, arguments);
          };
        }
      };
    },
    isNumber: function (o) {
      return !isNaN(o - 0) && o !== null && o !== '' && o !== false;
    },
    parseHTML: function (htmlString) {
      var container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.opacity = '0';

      container.innerHTML = htmlString;

      document.querySelector('body').appendChild(container);
      document.querySelector('body').removeChild(container);

      return Array.prototype.slice.call(container.childNodes);
    },
    serialize: function (obj, prefix) {
      var str = [], p;
      for (p in obj) {
        if (obj.hasOwnProperty(p)) {
          var k = prefix ? prefix + '[' + p + ']' : p, v = obj[ p ];
          str.push((v !== null && typeof v === 'object') ?
            galaxy.utility.serialize(v, k) :
            encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
      }
      return str.join('&');
    }
  };
})(Galaxy);
