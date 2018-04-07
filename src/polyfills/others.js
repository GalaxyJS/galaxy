(function () {
  if (typeof Object.assign != 'function') {
    Object.assign = function (target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      const to = Object(target);

      for (let index = 1; index < arguments.length; index++) {
        let nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (let nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }
})();

(function (root) {
  if (typeof root.CustomEvent === 'function') {
    return false;
  }

  function CustomEvent(event, params) {
    params = params || {bubbles: false, cancelable: false, detail: undefined};
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  }

  CustomEvent.prototype = root.Event.prototype;

  root.CustomEvent = CustomEvent;
})(this);

(function (root) {
  root.Reflect = root.Reflect || {
    deleteProperty: function (target, propertyKey) {
      delete target[propertyKey];
    }
  };
})(this);
