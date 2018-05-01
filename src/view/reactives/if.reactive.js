/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$if'] = {
    type: 'reactive',
    name: '$if'
  };

  GV.REACTIVE_BEHAVIORS['$if'] = {
    prepare: function () {
      return {
        onDone: function () { }
      };
    },
    install: function (config) {
      const parentNode = this.parent;
      parentNode.cache.mainChildIfQueue = parentNode.cache.mainChildIfQueue || [];
      parentNode.cache.mainChildIfLeaveProcesses = parentNode.cache.mainChildIfLeaveProcesses || [];
    },
    apply: function (config, value, oldValue, expression) {
      /** @type {Galaxy.View.ViewNode} */
      const node = this;
      const parentNode = node.parent;
      const parentSchema = parentNode.schema;

      if (expression) {
        value = expression();
      }

      node.renderingFlow.truncate();
      node.renderingFlow.onTruncate(function () {
        config.onDone.ignore = true;
      });

      if (value) {
        // Only apply $if logic on the elements that are rendered
        if (!node.rendered.resolved) {
          return;
        }

        const waitStepDone = registerWaitStep(parentNode.cache);
        waitStepDone();
      } else {
        const waitStepDone = registerWaitStep(parentNode.cache);
        const process = createFalseProcess(node, waitStepDone);
        if (parentSchema.renderConfig && parentSchema.renderConfig.domManipulationOrder === 'cascade') {
          parentNode.cache.mainChildIfLeaveProcesses.push(process);
        } else {
          parentNode.cache.mainChildIfLeaveProcesses.unshift(process);
        }
      }

      activateLeaveProcess(parentNode.cache);

      const whenAllLeavesAreDone = createWhenAllDoneProcess(parentNode.cache, function () {
        if (value) {
          runTrueProcess(node);
        }
      });
      config.onDone = whenAllLeavesAreDone;

      parentNode.cache.mainChildIfPromise = parentNode.cache.mainChildIfPromise || Promise.all(parentNode.cache.mainChildIfQueue);
      parentNode.cache.mainChildIfPromise.then(whenAllLeavesAreDone);
    }
  };

  /**
   *
   * @param {Object} parentCache
   * @returns {Function}
   */
  function registerWaitStep(parentCache) {
    let destroyDone;
    const waitForDestroy = new Promise(function (resolve) {
      destroyDone = function () {
        waitForDestroy.resolved = true;
        resolve();
      };
    });

    parentCache.mainChildIfQueue.push(waitForDestroy);

    return destroyDone;
  }

  function activateLeaveProcess(parentCache) {
    if (parentCache.mainChildIfLeaveProcesses.length && !parentCache.mainChildIfLeaveProcesses.active) {
      parentCache.mainChildIfLeaveProcesses.active = true;
      // We start the leaving process in the next frame so the app has enough time to register all the leave processes
      // that belong to parentNode
      requestAnimationFrame(function () {
        parentCache.mainChildIfLeaveProcesses.forEach(function (action) {
          action();
        });
        parentCache.mainChildIfLeaveProcesses = [];
        parentCache.mainChildIfLeaveProcesses.active = false;
      });
    }
  }

  /**
   *
   * @param {Object} parentCache
   * @param {Function} callback
   * @returns {Function}
   */
  function createWhenAllDoneProcess(parentCache, callback) {
    const whenAllLeavesAreDone = function () {
      if (whenAllLeavesAreDone.ignore) {
        return;
      }
      // Because the items inside mainChildIfQueue will change on the fly we have manually check whether all the
      // promises have resolved and if not we hav eto use Promise.all on the list again
      const allNotResolved = parentCache.mainChildIfQueue.some(function (promise) {
        return promise.resolved !== true;
      });

      if (allNotResolved) {
        // if not all resolved, then listen to the list again
        parentCache.mainChildIfQueue = parentCache.mainChildIfQueue.filter(function (p) {
          return !p.resolved;
        });

        parentCache.mainChildIfPromise = Promise.all(parentCache.mainChildIfQueue);
        parentCache.mainChildIfPromise.then(whenAllLeavesAreDone);
        return;
      }

      parentCache.mainChildIfPromise = null;
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
      // if (!node.inDOM && !node.node.parentNode) {
      node.setInDOM(true);
      // }
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
        // if (node.inDOM && node.node.parentNode) {
        node.setInDOM(false);
        // }

        onDone();
      });
    };
  }
})(Galaxy.View);

