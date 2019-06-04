/* global Galaxy, Promise */
'use strict';

Galaxy.Sequence = /** @class */ (function () {
  const disabledProcess = function () {
  };

  /**
   *
   * @constructor
   * @memberOf Galaxy.Sequence
   */
  function Process() {
    const _this = this;
    let _resolve;
    const p = new Promise(function (resolve) {
      _resolve = resolve;
    });
    _this.then = p.then;

    _this.cancel = function () {
      _this._canceled = true;
    };

    _this.proceed = function () {
      if (_this._canceled) {
        return;
      }

      _resolve();
    };

    _this.then = p.then.bind(p);
  }

  Process.prototype = {
    _canceled: false,
    cancel: null,
    proceed: null,
    then: null
  };

  Sequence.Process = Process;

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
    _this.truncating = false;
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

      _this.activeState = new Promise((function (_host) {
        return function (resolve) {
          _host.activeStateResolve = function () {
            _host.isFinished = true;
            _host.processing = false;
            if (_host.truncateHandlers.length > 1) {
              _host.truncateHandlers = [];
            }
            resolve();
          };
        };
      })(_this));

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
        // position: position,
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

      // if (position) {
      //   const subActions = _this.actions.filter(function (act) {
      //     return act.position === position;
      //   });
      //
      //   if (subActions.length) {
      //     const lastItem = subActions[subActions.length - 1];
      //     this.actions.splice(_this.actions.indexOf(lastItem) + 1, 0, act);
      //   } else {
      //     _this.actions.push(act);
      //   }
      // } else {
      _this.actions.push(act);
      // }

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

      if (firstAction) {
        _this.resolver.then(firstAction.run.bind(firstAction));
      } else if (oldAction) {
        _this.activeStateResolve();
      }
    },

    onTruncate: function (act) {
      const _this = this;
      if (_this.truncateHandlers.indexOf(act) === -1) {
        _this.truncateHandlers.push(act);
      }

      return function removeOnTruncate() {
        if (_this.truncating) {
          return;
        }

        const index = _this.truncateHandlers.indexOf(act);
        if (index !== -1) {
          _this.truncateHandlers.splice(index, 1);
        }
      };
    },

    truncate: function () {
      const _this = this;

      _this.truncating = true;
      _this.actions.forEach(function (item) {
        item.process = disabledProcess;
      });

      let i = 0;
      const len = _this.truncateHandlers.length;
      for (; i < len; i++) {
        if (!_this.truncateHandlers[i]) {
          continue;
        }
        _this.truncateHandlers[i].call(this);
      }

      _this.truncateHandlers = [];
      _this.isFinished = true;
      _this.processing = false;
      _this.truncating = false;
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
