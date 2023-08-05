import { def_prop } from './utils.js';

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
    def_prop(context, __observers__, {
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

export default Observer;
