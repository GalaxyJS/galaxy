/* global Galaxy */

Galaxy.GalaxyView.ReactiveData = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
  const defineProp = Object.defineProperty;

  /**
   *
   * @param {Object|Galaxy.GalaxyView.Portal} portal
   * @param {string} name
   * @param {*} value
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ReactiveData(data, key) {
    this.value = data[key];


  }

  ReactiveData.prototype.notify = function () {

  };

  return ReactiveData;

})();
