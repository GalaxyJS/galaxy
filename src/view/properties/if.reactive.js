/* global Galaxy */

(function (Galaxy) {
  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  Galaxy.View.REACTIVE_BEHAVIORS['$if'] = {
    prepare: function () {
      return {
        leaveProcessList: [],
        queue: [],
        mainPromise: null,
        onDone: function () {
        }
      };
    },
    install: function (config) {
      const parentNode = this.parent;
      parentNode.cache.$if = parentNode.cache.$if || {leaveProcessList: [], queue: [], mainPromise: null};
    },
    apply: function (config, value, oldValue, expression) {
      /** @type {Galaxy.View.ViewNode} */
      const node = this;
      const parentNode = node.parent;
      const parentCache = parentNode.cache;
      const parentSchema = parentNode.schema;

      if (expression) {
        value = expression();
      }

      // Only apply $if logic on the elements that are rendered
      if (!node.rendered.resolved) {
        if (!value) {
          node.inDOM = false;
        }
        return;
      }

      // node.renderingFlow.truncate();
      // node.renderingFlow.onTruncate(function () {
      //   config.onDone.ignore = true;
      // });


      Galaxy.View.CREATE_IN_NEXT_FRAME(node, function () {
        node.setInDOM(value);
      });

      // if (value) {
      //   const waitStepDone = registerWaitStep(parentCache.$if);
      //   node.renderingFlow.nextAction(function () {
      //     waitStepDone();
      //   });
      // } else {
      //   const waitStepDone = registerWaitStep(parentCache.$if);
      //   const process = createFalseProcess(node, waitStepDone);
      //   if (parentSchema.renderConfig && parentSchema.renderConfig.alternateDOMFlow === false) {
      //     parentCache.$if.leaveProcessList.push(process);
      //   } else {
      //     parentCache.$if.leaveProcessList.unshift(process);
      //   }
      // }
      //
      // activateLeaveProcess(parentCache.$if);
      //
      // const whenAllLeavesAreDone = createWhenAllDoneProcess(parentCache.$if, function () {
      //   if (value) {
      //     runTrueProcess(node);
      //   }
      // });
      // config.onDone = whenAllLeavesAreDone;
      //
      // parentCache.$if.mainPromise = parentCache.$if.mainPromise || Promise.all(parentNode.cache.$if.queue);
      // parentCache.$if.mainPromise.then(whenAllLeavesAreDone);
    }
  };

  /**
   *
   * @param {Object} $ifData
   * @returns {Function}
   */
  function registerWaitStep($ifData) {
    let destroyDone;
    const waitForDestroy = new Promise(function (resolve) {
      destroyDone = function () {
        waitForDestroy.resolved = true;
        resolve();
      };
    });

    $ifData.queue.push(waitForDestroy);

    return destroyDone;
  }

  function activateLeaveProcess($ifData) {
    if ($ifData.leaveProcessList.length && !$ifData.leaveProcessList.active) {
      $ifData.leaveProcessList.active = true;
      // We start the leaving process in the next frame so the app has enough time to register all the leave processes
      // that belong to parentNode
      Promise.resolve().then(function () {
        $ifData.leaveProcessList.forEach(function (action) {
          action();
        });
        $ifData.leaveProcessList = [];
        $ifData.leaveProcessList.active = false;
      });
    }
  }

  /**
   *
   * @param {Object} $ifData
   * @param {Function} callback
   * @returns {Function}
   */
  function createWhenAllDoneProcess($ifData, callback) {
    const whenAllLeavesAreDone = function () {
      if (whenAllLeavesAreDone.ignore) {
        return;
      }
      // Because the items inside queue will change on the fly we have manually check whether all the
      // promises have resolved and if not we hav eto use Promise.all on the list again
      const allNotResolved = $ifData.queue.some(function (promise) {
        return promise.resolved !== true;
      });

      if (allNotResolved) {
        // if not all resolved, then listen to the list again
        $ifData.queue = $ifData.queue.filter(function (p) {
          return !p.resolved;
        });

        $ifData.mainPromise = Promise.all($ifData.queue);
        $ifData.mainPromise.then(whenAllLeavesAreDone);
        return;
      }

      $ifData.queue = [];
      $ifData.mainPromise = null;
      callback();
    };

    return whenAllLeavesAreDone;
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   */
  function runTrueProcess(node) {
    node.renderingFlow.nextAction(function () {
      node.setInDOM(true);
    });
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param {Function} onDone
   * @returns {Function}
   */
  function createFalseProcess(node, onDone) {
    return function () {
      node.renderingFlow.nextAction(function () {
        node.setInDOM(false);
        onDone();
      });
    };
  }
})(Galaxy);

