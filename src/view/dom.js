'use strict';

Galaxy.DOM = /** @class */(function () {

  /**
   *
   * @constructor
   * @memberOf Galaxy
   */
  function DOM() {
    this.lastFrameId = null;
  }

  DOM.prototype = {
    destroyNodes(nodes, sequence, root) {
      if (this.lastFrameId) {
        cancelAnimationFrame(this.lastFrameId);
        this.lastFrameId = null;
      }

      this.lastFrameId = requestAnimationFrame(() => {
        // sort nodes descending
        // remove nodes
      });
    }
  };
})();
