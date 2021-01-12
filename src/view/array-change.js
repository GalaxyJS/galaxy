/* global Galaxy */
Galaxy.View.ArrayChange = /** @class */ (function (G) {
  let lastId = 0;

  function ArrayChange() {
    this.id = lastId++;
    if (lastId > 100000000) {
      lastId = 0;
    }
    this.init = null;
    this.original = null;
    // this.snapshot = [];
    this.returnValue = null;
    this.params = [];
    this.type = 'reset';

    Object.preventExtensions(this);
  }

  ArrayChange.prototype = {
    getInstance: function () {
      const instance = new G.View.ArrayChange();
      instance.init = this.init;
      instance.original = this.original;
      instance.params = this.params.slice(0);
      instance.type = this.type;

      return instance;
    }
  };

  return ArrayChange;
})(Galaxy);
