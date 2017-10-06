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
    this.lastTimestamp = Date.now();
    this.offset = 0;
    this.reset();
    this.children = [];
  }

  GalaxySequence.prototype.start = function () {
    if (this.started) return this;

    this.firstStepResolve();
    this.started = true;
    return this;
  };

  GalaxySequence.prototype.reset = function () {
    const _this = this;
    _this.offset = 0;
    _this.children = [];

    _this.line = new Promise(function (resolve) {
      _this.firstStepResolve = resolve;
    });

    this.started = false;
    return _this;
  };

  GalaxySequence.prototype.next = function (action) {
    const _this = this;
    let thunk;
    _this.offset++;
    let promise = new Promise(function (resolve, reject) {
      // const timestamp = Date.now();
      // if (_this.lastTimestamp !== timestamp) {
      //   _this.lastTimestamp = timestamp;
      //   _this.offset = 0;
      // } else {
      //   _this.offset++;
      // }
      //
      // const id = _this.lastTimestamp + '-' + _this.offset;
      thunk = function () {
        _this.offset--;
        action.call(null, resolve, reject);
      };
    });

    this.children.push(promise);

    this.line.then(thunk).catch(thunk);
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


})(Galaxy);
