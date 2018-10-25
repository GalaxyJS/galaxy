/* global Galaxy */

Galaxy.View.ArrayChange = /** @class */ (function () {
  function ArrayChange() {
    this.init = null;
    this.original = null;
    this.snapshot = [];
    this.returnValue = null;
    this.params = [];
    this.type = 'reset';

    Object.preventExtensions(this);
  }

  ArrayChange.prototype = {
    getInstance: function () {
      const instance = new Galaxy.View.ArrayChange();
      instance.init = this.init;
      instance.original = this.original;
      // instance.snapshot = this.snapshot.slice(0);
      instance.params = this.params.slice(0);
      instance.type = this.type;
      // instance.ts = getTS();

      return instance;
    }
  };

  return ArrayChange;
})();
