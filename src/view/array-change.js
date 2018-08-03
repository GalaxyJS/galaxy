/* global Galaxy */

Galaxy.View.ArrayChange = /** @class */ (function () {
  // let lastTS = new Date().getTime();
  // let counter = 0;
  //
  // function getTS() {
  //   const currentTS = new Date().getTime();
  //
  //   if (currentTS === lastTS) {
  //     counter++;
  //
  //     return currentTS + '-' + counter;
  //   }
  //
  //   counter = 0;
  //   lastTS = currentTS;
  //
  //   return currentTS + '-' + counter;
  // }

  function ArrayChange() {
    this.init = null;
    this.original = null;
    this.snapshot = [];
    this.returnValue = null;
    this.params = [];
    this.type = 'reset';
    // this.ts = getTS();

    Object.preventExtensions(this);
  }

  ArrayChange.prototype.getInstance = function () {
    const instance = new Galaxy.View.ArrayChange();
    instance.init = this.init;
    instance.original = this.original;
    instance.snapshot = this.snapshot.slice(0);
    instance.params = this.params.slice(0);
    instance.type = this.type;
    // instance.ts = getTS();

    return instance;
  };

  return ArrayChange;
})();
