/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxySequence = /** @class */ (function (G) {
  /**
   *
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxySequence() {
    this.line = null;
    this.firstStepResolve = null;
    this.started = false;
    this.children = [];
    this.reset();
  }

  GalaxySequence.prototype.start = function () {
    if (this.started) return this;

    this.firstStepResolve();
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

    let thunk;
    let promise = new Promise(function (resolve, reject) {
      thunk = function () {
        action.call(null, resolve, reject);
      };
    });

    this.children.push(promise);

    this.line.then(thunk).catch(function (e) {
      console.error(e);
    });
    this.line = promise;

    return _this;
  };

  GalaxySequence.prototype.nextAction = function (action) {
    this.next(function (done) {
      action.call();
      done();
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
