/* global Galaxy, Promise */
'use strict';

Galaxy.Sequence = /** @class */ (function () {
  const disabledProcess = function () {
  };

  /**
   *
   * @constructor
   * @memberOf Galaxy
   */
  function Sequence() {
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

    _this.reset();
  }

  Sequence.prototype = {
    reset: function () {
      const _this = this;
      _this.actions = [];
      _this.isFinished = false;
      _this.processing = false;

      _this.activeState = new Promise(function (resolve) {
        _this.activeStateResolve = function () {
          _this.isFinished = true;
          _this.processing = false;
          // _this.truncateHandlers = [];
          resolve();
        };
      });

      return _this;
    },

    next: function (action, ref, position) {
      const _this = this;

      // if sequence was finished, then reset the sequence
      if (_this.isFinished) {
        _this.reset();
      }

      // we create an act object in order to be able to change the process on the fly
      // when this sequence is truncated, then the process of any active action should be disabled
      const act = {
        position: position,
        data: {
          ref: ref
        },
        process: _this.proceed,
        run: function run() {
          const local = this;
          action.call(local.data, function () {
            local.process.call(_this);
          }, function (e) {
            console.error(e);
          });
        }
      };

      if (position) {
        const subActions = _this.actions.filter(function (act) {
          return act.position === position;
        });

        if (subActions.length) {
          const lastItem = subActions[subActions.length - 1];
          // debugger
          this.actions.splice(_this.actions.indexOf(lastItem) + 1, 0, act);
          // debugger
        } else {
          _this.actions.push(act);
        }
      } else {
        _this.actions.push(act);
      }

      if (!_this.processing) {
        _this.processing = true;
        _this.resolver.then(act.run.bind(act));
      }

      return _this;
    },

    proceed: function sequenceProceed() {
      const _this = this;
      const oldAction = _this.actions.shift();
      const firstAction = _this.actions[0];
      // console.log('should end',_this.actions.length, firstAction);
      if (firstAction) {
        _this.resolver.then(firstAction.run.bind(firstAction));
      } else if (oldAction) {
        // _this.resolver.then(function () {
        _this.activeStateResolve();
        // });
      }
    },

    onTruncate: function (act) {
      if (this.truncateHandlers.indexOf(act) === -1) {
        this.truncateHandlers.push(act);
      }
    },

    truncate: function () {
      const _this = this;

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

    removeByRef: function (ref) {
      let first = false;
      this.actions = this.actions.filter(function (item, i) {
        const flag = item.data.ref !== ref;
        if (flag && i === 0) {
          first = true;
        }
        return flag;
      });

      if (first && this.actions[0]) {
        this.actions[0].run();
      } else if (!first && !this.actions[0] && this.processing && !this.isFinished) {
        this.activeStateResolve();
      }
    },

    nextAction: function (action, ref, position) {
      this.next(function (done) {
        action.call(this);
        done('sequence-action');
      }, ref, position);
    }
  };
  return Sequence;
})();
