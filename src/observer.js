/* global Galaxy */
'use strict';

Galaxy.Observer = /** @class */ (function () {
  const defProp = Object.defineProperty;

  Observer.notify = function (obj, key, value, oldValue) {
    const observers = obj.__observers__;

    if (observers !== undefined) {
      observers.forEach(function (observer) {
        observer.notify(key, value, oldValue);
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

    if (!this.context.hasOwnProperty('__observers__')) {
      defProp(context, '__observers__', {
        value: [],
        writable: true,
        configurable: true
      });
    }

    this.context['__observers__'].push(this);
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
     * @param oldValue
     */
    notify: function (key, value, oldValue) {
      const _this = this;

      if (_this.subjectsActions.hasOwnProperty(key)) {
        _this.subjectsActions[key].call(_this.context, value, oldValue);
      }

      _this.allSubjectAction.forEach(function (action) {
        action.call(_this.context, key, value, oldValue);
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
