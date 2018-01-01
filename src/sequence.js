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
  function GalaxySequence(continues) {
    const _this = this;
    // _this.continues = continues || false;
    // _this.truncated = false;
    _this.truncateHandlers = [];
    // _this.line = null;
    // _this.firstStepResolve = null;
    _this.activeStateResolve = null;
    _this.isFinished = false;
    // _this.started = false;
    _this.processing = false;
    /** activeState is a promise that will resolve when all the sequence activities has been resolved
     *
     * @type {Promise}
     */
    _this.activeState = Promise.resolve('sequence-constructor');
    // _this.children = [];
    _this.actions = [];

    this.reset();
  }

  GalaxySequence.prototype.start = function () {
    // if (this.started) return this;
    //
    // this.firstStepResolve('sequence-start');
    // this.started = true;
    return this;
  };

  GalaxySequence.prototype.reset = function () {
    const _this = this;
    _this.actions = [];
    _this.isFinished = false;
    _this.processing = false;
    // _this.children = [];
    //
    // _this.line = new Promise(function (resolve) {
    //   _this.firstStepResolve = resolve;
    // });
    // this.startP = _this.line;
    // this.started = false;

    this.activeState = new Promise(function (resolve) {
      _this.activeStateResolve = function () {
        _this.isFinished = true;
        _this.processing = false;
        resolve();
      };
    });

    return _this;
  };

  GalaxySequence.prototype.next = function (action) {
    const _this = this;

    // if sequence was finished, then reset the sequence
    if (_this.isFinished) {
      _this.reset();
    }

    // _this.truncated = false;
    // let promise = new Promise(function (resolve, reject) {
    //   thunk = function () {
    //     if (_this.truncated) {
    //       return reject('sequence-rejected ' + _this.actions.indexOf(promise));
    //     }
    //
    //     action.call(null, resolve, reject);
    //   };
    // });

    // let promise = new Promise(function (resolve, reject) {

    // we create an act object in order to be able to change the process on the fly
    // when this sequence is truncated, then the process of any active action should be disabled
    const act = {
      process: this.proceed,
      run: function () {
        const local = this;
        action.call(null, function () {
          local.process.call(_this);
        }, function (e) {
          console.error(e);
        });
      }
    };

    // const actionWrapper = o;

    // actionWrapper.proceed = this.proceed;
    // });

    // if (!this.continues) {
    //   this.children.push(promise);
    // }
    // this.actions.push(promise);

    // if (!this.continues) {
    //   this.children.push(promise);
    // }
    this.actions.push(act);

    if (!_this.processing) {
      _this.processing = true;
      Promise.resolve().then(act.run.bind(act));
      // requestAnimationFrame(act.run.bind(act));
      // setTimeout(act.run.bind(act));
      // act.run();
    }

    // this.line.then(function () {
    //   if (_this.truncated) return Promise.reject();
    //   thunk();
    // }).catch(function (e) {
    //   console.error(e);
    // });
    // this.line = promise;

    // promise.then(function () {
    //   thunk();
    //   _this.actions.shift();
    //   _this.proceed();
    // }).catch(function (e) {
    //   console.error(e);
    // });

    return _this;
  };

  GalaxySequence.prototype.proceed = function (p) {
    const _this = this;
    const oldAction = _this.actions.shift();
    const firstAction = _this.actions[0];
    if (firstAction) {
      Promise.resolve().then(firstAction.run.bind(firstAction));
      // requestAnimationFrame(firstAction.run.bind(firstAction));
      // setTimeout(firstAction.run.bind(firstAction));
      // firstAction.run();
    } else if (oldAction) {
      // Promise.resolve().then(_this.activeStateResolve);
      _this.activeStateResolve();
    }
  };

  GalaxySequence.prototype.onTruncate = function (act) {
    if (this.truncateHandlers.indexOf(act) === -1) {
      this.truncateHandlers.push(act);
    }
  };

  GalaxySequence.prototype.truncate = function () {
    const _this = this;
    _this.actions.forEach(function (item) {
      item.process = disabledProcess;
    });

    let i = 0, len = this.truncateHandlers.length;
    for (; i < len; i++) {
      this.truncateHandlers[i].call(this);
    }

    this.truncateHandlers = [];
    _this.activeStateResolve();
    _this.reset();

    return _this;
  };

  GalaxySequence.prototype.nextAction = function (action) {
    this.next(function (done) {
      action.call();
      done('sequence-action');
    });
  };

  // GalaxySequence.prototype.finish = function (action) {
  //   const _this = this;
  //   Promise.all(this.children).then(function () {
  //     _this.children = [];
  //     action.call();
  //   });
  // };

  return GalaxySequence;
})();
