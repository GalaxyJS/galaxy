/* global Galaxy, Promise */
'use strict';

(function (GV) {
  /**
   *
   * @returns {Galaxy.GalaxyView.StateTree}
   */
  GV.StateTree = StateTree;

  function StateTree() {
    this.commands = [];
    this.children = [];
    this.isBusy = false;
    this.hasBusyChild = false;
    this.parent = null;
    this.sequence = new Galaxy.GalaxySequence().start();
  }

  StateTree.prototype.update = function () {
    let child;
    this.hasBusyChild = false;
    for (let i = 0, len = this.children.length; i < len; i++) {
      child = this.children[i];
      if (child.isBusy) {
        this.hasBusyChild = true;
      }

      return;
    }

    if (!this.hasBusyChild && !this.isBusy) {
      this.proceed();
    }

    if (this.parent) {
      this.parent.update();
    }
  };

  StateTree.prototype.proceed = function () {
    const action = this.commands.shift();

    if (action) {
      this.sequence.next(action);
    }
  };

  StateTree.prototype.busy = function () {
    this.isBusy = true;
    this.update();
  };

  StateTree.prototype.idle = function () {
    this.isBusy = false;
    this.update();
  };

  StateTree.prototype.add = function (stateTree) {
    if (this.children.indexOf(stateTree) === -1) {
      this.children.push(stateTree);
      stateTree.parent = this;
    }

    this.update();
  };

  StateTree.prototype.remove = function (stateTree) {
    if (this.children.indexOf(stateTree) !== -1) {
      this.children.splice(this.children.indexOf(stateTree), 1);
    }

    this.update();
  };

  StateTree.prototype.next = function (command) {
    this.commands.push(command);
    this.update();
  };

})(Galaxy.GalaxyView);
