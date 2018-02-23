/* global Galaxy */
'use strict';

Galaxy.GalaxyObserver = /** @class */ (function () {
  const G = Galaxy;

  GalaxyObserver.notify = function (obj, key, value, oldValue,caller) {
    const observers = obj.__observers__;
    const parents = obj.__parents__;

    if (observers !== undefined) {
      observers.forEach(function (observer) {
        observer.notify(key, value, oldValue);
      });
    }

    if (parents !== undefined) {
      parents.forEach(function (bp) {
        if(bp.host[bp.name] !== caller) {
          GalaxyObserver.notify(bp.host[bp.name], key, value, oldValue, bp.host[bp.name]);
        }
      });
    }
  };

  /**
   *
   * @param {Object} context
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxyObserver(context) {
    this.context = context;
    this.subjectsActions = {};
    this.allSubjectAction = [];

    if (!this.context.hasOwnProperty('__observers__')) {
      G.defineProp(context, '__observers__', {
        value: [],
        writable: true,
        configurable: true
      });
    }

    this.context.__observers__.push(this);
  }

  GalaxyObserver.prototype.remove = function () {
    let index = this.context.__observers__.indexOf(this);
    if (index !== -1) {
      this.context.__observers__.splice(index, 1);
    }
  };

  GalaxyObserver.prototype.notify = function (key, value, oldValue) {
    const _this = this;

    if (_this.subjectsActions.hasOwnProperty(key)) {
      _this.subjectsActions[key].call(_this.context, value, oldValue);
    }

    _this.allSubjectAction.forEach(function (action) {
      action.call(_this.context, key, value, oldValue);
    });
  };

  GalaxyObserver.prototype.on = function (subject, action) {
    this.subjectsActions[subject] = action;
  };

  GalaxyObserver.prototype.onAll = function (action) {
    if (this.allSubjectAction.indexOf(action) === -1) {
      this.allSubjectAction.push(action);
    }
  };

  return GalaxyObserver;
})();
