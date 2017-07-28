/* global Galaxy, Promise */

(function (G) {
  /**
   *
   * @returns {Galaxy.GalaxyScope}
   */
  G.GalaxySequence = GalaxySequence;

  function GalaxySequence() {
    this.line = null;
    this.firstStepResolve = null;
    this.reset();
  }

  GalaxySequence.prototype.start = function () {
    this.firstStepResolve();
    return this;
  };

  GalaxySequence.prototype.reset = function () {
    var _this = this;

    _this.line = new Promise(function (resolve) {
      _this.firstStepResolve = resolve;
    });

    return _this;
  };

  GalaxySequence.prototype.next = function (action) {
    var thunk;
    var promise = new Promise(function (resolve, reject) {
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
