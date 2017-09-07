/* global Galaxy, Promise */
'use strict';

(function (G) {
  /**
   *
   * @returns {Galaxy.GalaxyScope}
   */
  G.GalaxySequence = GalaxySequence;

  function GalaxySequence() {
    this.line = null;
    this.firstStepResolve = null;
    this.started = false;
    this.reset();
  }

  GalaxySequence.prototype.start = function () {
    if (this.started) return this;

    this.firstStepResolve();
    this.started = true;
    return this;
  };

  GalaxySequence.prototype.reset = function () {
    let _this = this;

    _this.line = new Promise(function (resolve) {
      _this.firstStepResolve = resolve;
    });

    this.started = false;
    return _this;
  };

  GalaxySequence.prototype.next = function (action) {
    let thunk;
    let promise = new Promise(function (resolve, reject) {
      thunk = function () {
        action(resolve, reject);
      };
    });

    this.line.then(thunk).catch(thunk);
    this.line = promise;

    return promise;
  };

  GalaxySequence.prototype.finish = function (action) {
    this.line.then(action);
  };


})(Galaxy);
