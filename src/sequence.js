/* global Galaxy, Promise */

(function (G) {
  /**
   *
   * @returns {Galaxy.GalaxyScope}
   */
  G.GalaxySequence = GalaxySequence;

  function GalaxySequence() {
    this.line = Promise.resolve();
  }

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


})(Galaxy);
