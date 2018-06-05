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
      parentNode.cache.leaveByIfProcessList = parentNode.cache.leaveByIfProcessList || [];
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
        if (!node.rendered.resolved) {
          node.inDOM = false;
          return;
        }

        const waitStepDone = registerWaitStep(parentNode.cache);
        const process = createFalseProcess(node, waitStepDone);
        if (parentSchema.renderConfig && parentSchema.renderConfig.domManipulationOrder === 'cascade') {
          parentNode.cache.leaveByIfProcessList.push(process);
        } else {
          parentNode.cache.leaveByIfProcessList.unshift(process);
        }
      }

      activateLeaveProcess(parentNode.cache);

      const whenAllLeavesAreDone = createWhenAllDoneProcess(parentNode.cache, function () {
        if (value) {

          runTrueProcess(node);
        } else {

        }
      });
      config.onDone = whenAllLeavesAreDone;

      parentNode.cache.ifOparetionsMainPromise = parentNode.cache.ifOparetionsMainPromise || Promise.all(parentNode.cache.mainChildIfQueue);
      parentNode.cache.ifOparetionsMainPromise.then(whenAllLeavesAreDone);
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
    if (parentCache.leaveByIfProcessList.length && !parentCache.leaveByIfProcessList.active) {
      parentCache.leaveByIfProcessList.active = true;
      // We start the leaving process in the next frame so the app has enough time to register all the leave processes
      // that belong to parentNode
      Promise.resolve().then(function () {
        parentCache.leaveByIfProcessList.forEach(function (action) {
          action();
        });
        parentCache.leaveByIfProcessList = [];
        parentCache.leaveByIfProcessList.active = false;
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

        parentCache.ifOparetionsMainPromise = Promise.all(parentCache.mainChildIfQueue);
        parentCache.ifOparetionsMainPromise.then(whenAllLeavesAreDone);
        return;
      }

      parentCache.ifOparetionsMainPromise = null;
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

