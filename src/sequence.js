/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxySequence = /** @class */ (function () {
  const disabledProcess = function () {

  };

  /**
   *
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxySequence() {
    const _this = this;
    _this.truncateHandlers = [];
    _this.activeStateResolve = null;
    _this.isFinished = false;
    _this.processing = false;
    /** activeState is a promise that will resolve when all the sequence activities has been resolved
     *
     * @type {Promise}
     */
    _this.activeState = Promise.resolve('sequence-constructor');
    _this.actions = [];
    _this.resolver = Promise.resolve();
    _this.trun = 0;

    this.reset();
  }

  GalaxySequence.prototype = {
    reset: function () {
      const _this = this;
      _this.actions = [];
      _this.isFinished = false;
      _this.processing = false;

      this.activeState = new Promise(function (resolve) {
        _this.activeStateResolve = function () {
          _this.isFinished = true;
          _this.processing = false;
          resolve();
        };
      });

      return _this;
    },

    next: function (action) {
      const _this = this;

      // if sequence was finished, then reset the sequence
      if (_this.isFinished) {
        _this.reset();
      }

      // we create an act object in order to be able to change the process on the fly
      // when this sequence is truncated, then the process of any active action should be disabled
      const act = {
        data: { },
        process: this.proceed,
        run: function run() {
          const local = this;
          action.call(local.data, function () {
            local.process.call(_this);
          }, function (e) {
            console.error(e);
          });
        }
      };

      // This will fix and strange bug
      // if (_this.isFinished === false && _this.processing && _this.actions.length === 0) {
      //   debugger;
      //   _this.processing = false;
      // }

      _this.actions.push(act);

      if (!_this.processing) {
        _this.processing = true;
        _this.resolver.then(act.run.bind(act));
      }

      return _this;
    },

    proceed: function (p) {
      const _this = this;
      const oldAction = _this.actions.shift();
      const firstAction = _this.actions[0];
      if (firstAction) {
        _this.resolver.then(firstAction.run.bind(firstAction));
      } else if (oldAction) {
        _this.resolver.then(_this.activeStateResolve.bind(_this));
      }
    },

    onTruncate: function (act) {
      if (this.truncateHandlers.indexOf(act) === -1) {
        this.truncateHandlers.push(act);
      }
    },

    truncate: function () {
      const _this = this;
      _this.trun++;

      _this.actions.forEach(function (item) {
        item.process = disabledProcess;
      });

      let i = 0;
      const len = _this.truncateHandlers.length;
      for (; i < len; i++) {
        _this.truncateHandlers[i].call(this);
      }

      _this.truncateHandlers = [];
      _this.isFinished = true;
      _this.processing = false;
      _this.actions = [];

      return _this;
    },

    nextAction: function (action) {
      this.next(function (done) {
        action.call(this);
        done('sequence-action');
      });
    }
  };
  return GalaxySequence;
})();
