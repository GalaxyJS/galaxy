/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxySequence = /** @class */ (function (G) {
  /**
   *
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxySequence(continues) {
    this.continues = continues || false;
    this.truncated = false;
    this.truncateHandlers = [];
    this.line = null;
    this.firstStepResolve = null;
    this.started = false;
    this.children = [];
    this.reset();
  }

  GalaxySequence.prototype.start = function () {
    if (this.started) return this;

    this.firstStepResolve('sequence-start');
    this.started = true;
    return this;
  };

  GalaxySequence.prototype.reset = function () {
    const _this = this;
    _this.children = [];

    _this.line = new Promise(function (resolve) {
      _this.firstStepResolve = resolve;
    });
    this.startP = _this.line;
    this.started = false;
    return _this;
  };

  GalaxySequence.prototype.next = function (action) {
    const _this = this;
    _this.truncated = false;

    let thunk;
    let promise = new Promise(function (resolve, reject) {
      thunk = function () {
        if (_this.truncated) {
          return;
        }

        action.call(null, resolve, reject);
      };
    });

    if (!this.continues) {
      this.children.push(promise);
    }

    this.line.then(thunk).catch(function (e) {
      console.error(e);
    });
    this.line = promise;

    return _this;
  };

  GalaxySequence.prototype.onTruncate = function (act) {
    if (this.truncateHandlers.indexOf(act) === -1) {
      this.truncateHandlers.push(act);
    }
  };

  GalaxySequence.prototype.truncate = function () {
    const _this = this;
    _this.truncated = true;

    let i = 0, len = this.truncateHandlers.length;
    for (; i < len; i++) {
      this.truncateHandlers[i].call(this);
    }

    this.truncateHandlers = [];
    _this.reset();

    return _this;
  };

  GalaxySequence.prototype.nextAction = function (action) {
    this.next(function (done) {
      action.call();
      done('sequence-action');
    });
  };

  GalaxySequence.prototype.finish = function (action) {
    const _this = this;
    Promise.all(this.children).then(function () {
      _this.children = [];
      action.call();
    });
  };

  return GalaxySequence;
})(Galaxy);
