/* global Galaxy */

Galaxy.View.ArrayChange = /** @class */ (function () {
  function ArrayChange() {
    this.init = null;
    this.original = null;
    this.snapshot = [];
    this.returnValue = null;
    this.params = [];
    this.type = 'reset';
  }

  ArrayChange.prototype.getInstance = function () {
    const instance = new Galaxy.View.ArrayChange();
    instance.init = this.init;
    instance.original = this.original;
    instance.snapshot = this.snapshot.slice(0);
    instance.params = this.params.slice(0);
    instance.type = this.type;
    // instance.ts = new Date().getTime();

    return instance;
  };

  return ArrayChange;
})();
