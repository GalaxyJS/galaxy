/* global Galaxy */

(function (Galaxy) {
  const View = Galaxy.View;
  View.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  View.REACTIVE_BEHAVIORS['$for'] = {
    regex: null,
    prepare: function (options, scope) {
      this.virtualize();

      return {
        nodes: [],
        options: options,
        oldChanges: {},
        positions: [],
        trackMap: [],
        scope: scope,
        trackBy: options.trackBy
      };
    },

    /**
     *
     * @typedef {Object} RenderJobManager
     * @property {Array.<Function>} steps
     * @property {Array.<Promise>} queue
     * @property {Promise} mainPromise
     */

    /**
     *
     * @param config Return of prepare method
     */
    install: function (config) {
      const node = this;
      const parentNode = node.parent;
      /**
       *
       * @type {RenderJobManager}
       */
      parentNode.cache.$for = parentNode.cache.$for || { steps: [], queue: [], mainPromise: null };

      if (config.options instanceof Array) {
        View.makeBinding(this, '$for', undefined, config.scope, {
          isExpression: false,
          modifiers: null,
          propertyKeysPaths: [config.options[2] + '.changes']
        }, this);
      } else if (config.options) {
        const bindings = View.getBindings(config.options.data);
        config.watch = bindings.propertyKeysPaths;
        node.localPropertyNames.add(config.options.as);
        if (config.options.indexAs) {
          node.localPropertyNames.add(config.options.indexAs);
        }

        if (bindings.propertyKeysPaths) {
          View.makeBinding(node, '$for', undefined, config.scope, bindings, node);
          bindings.propertyKeysPaths.forEach(function (path) {
            try {
              const rd = View.propertyScopeLookup(config.scope, path);
              node.addDependedObject(rd, node);
            } catch (error) {
              console.error('Could not find: ' + path + '\n', error);
            }
          });
        } else if (config.options.data instanceof Array) {
          const setter = node.setters['$for'] = View.createSetter(node, '$for', config.options.data, null, config.scope);
          const value = new Galaxy.View.ArrayChange();
          value.params = config.options.data;
          setter(value);
        }
      }

      return false;
    },

    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param config The return of prepare
     * @param changes
     * @param oldChanges
     * @param {Function} expression
     */
    apply: function (config, changes, oldChanges, expression) {
      // The idea is that when the
      if (expression) {
        changes = expression();
        if (changes === null || changes === undefined) {
          return;
        }

        if (!(changes instanceof Galaxy.View.ArrayChange)) {
          console.warn(changes);
          throw new Error('$for: Expression has to return an ArrayChange instance or null \n' + config.watch.join(' , ') + '\n');
        }
      }

      if (changes && !(changes instanceof Galaxy.View.ArrayChange)) {
        return console.warn('$for data is not a type of ArrayChange\nPassed type is ' + typeof changes, config.options);
      }

      if (!changes || typeof changes === 'string') {
        changes = {
          type: 'reset',
          params: []
        };
      }

      /** @type {Galaxy.View.ViewNode} */
      const node = this;
      const parent = node.parent;
      const parentCache = parent.cache;
      const parentSchema = parent.schema;
      let newTrackMap = null;

      config.oldChanges = changes;
      parent.inserted.then(afterInserted);

      function afterInserted() {
        // Truncate on reset or actions that does not change the array length
        if (changes.type === 'reset' || changes.type === 'reverse' || changes.type === 'sort') {
          node.renderingFlow.truncate();
          node.renderingFlow.onTruncate(function () {
            whenAllLeavesAreDone.cancel();
          });
        }
        if(parent.schema.class === 'sub-nav-container') debugger;

        const waitStepDone = registerWaitStep(parentCache.$for, parent.sequences.leave);
        let leaveStep = null;
        if (config.trackBy instanceof Function && changes.type === 'reset') {
          newTrackMap = changes.params.map(function (item, i) {
            return config.trackBy.call(node, item, i);
          });
          // list of nodes that should be removed
          const hasBeenRemoved = [];
          config.trackMap.forEach(function (id, i) {
            if (newTrackMap.indexOf(id) === -1 && config.nodes[i]) {
              hasBeenRemoved.push(config.nodes[i]);
            }
          });

          const newParams = [];
          const positions = [];
          newTrackMap.forEach(function (id, i) {
            if (config.trackMap.indexOf(id) === -1) {
              newParams.push(changes.params[i]);
              positions.push(i);
            }
          });
          config.positions = positions;

          const newChanges = new Galaxy.View.ArrayChange();
          newChanges.init = changes.init;
          newChanges.type = changes.type;
          newChanges.original = changes.original;
          newChanges.params = newParams;
          newChanges.__rd__ = changes.__rd__;
          if (newChanges.type === 'reset' && newChanges.params.length) {
            newChanges.type = 'push';
          }

          config.nodes = config.nodes.filter(function (node) {
            return hasBeenRemoved.indexOf(node) === -1;
          });

          leaveStep = createLeaveStep(node, hasBeenRemoved, function () {
            changes = newChanges;
            waitStepDone();
          });

          // Map should be updated asap if the newChanges.type is reset
          if (newChanges.type === 'reset' && newChanges.params.length === 0) {
            config.trackMap = newTrackMap;
          }
        } else if (changes.type === 'reset') {
          const nodesToBeRemoved = config.nodes.slice(0);
          config.nodes = [];
          leaveStep = createLeaveStep(node, nodesToBeRemoved, function () {
            changes = Object.assign({}, changes);
            changes.type = 'push';
            waitStepDone();
          });
        } else {
          // if type is not 'reset' then there is no need for leave step
          Promise.resolve().then(waitStepDone);
        }

        // leave process will be empty if the type is not reset
        if (leaveStep) {
          if (parentSchema.renderConfig && parentSchema.renderConfig.alternateDOMFlow === false) {
            parentCache.$for.steps.push(leaveStep);
          } else {
            parentCache.$for.steps.unshift(leaveStep);
          }
        }

        activateLeaveProcess(parentCache.$for);

        const whenAllLeavesAreDone = createWhenAllDoneProcess(parentCache.$for);
        whenAllLeavesAreDone.then(function () {
          if (newTrackMap) {
            config.trackMap = newTrackMap;
          }

          if (changes.type === 'reset' && changes.params.length === 0) {
            return;
          }

          createPushProcess(node, config, changes, config.scope);
        });
      }
    }
  };

  /**
   *
   * @param {RenderJobManager} jobManager
   * @param {Galaxy.Sequence} parentLeaveSequence
   * @returns {Function}
   */
  function registerWaitStep(jobManager, parentLeaveSequence) {
    let destroyDone;
    const waitForDestroy = new Promise(function (resolve) {
      destroyDone = function () {
        removeOnTruncateHandler();
        waitForDestroy.resolved = true;
        resolve();
      };
    });

    // Wait step won't be resolve if the parent leave sequence get truncated. that's why we need to resolve it if that happens
    const removeOnTruncateHandler = parentLeaveSequence.onTruncate(function passWaitStep() {
      if (!waitForDestroy.resolved) {
        destroyDone();
      }
    });

    jobManager.queue.push(waitForDestroy);
    return destroyDone;
  }

  /**
   *
   * @param {RenderJobManager} jobManager
   */
  function activateLeaveProcess(jobManager) {
    if (jobManager.steps.length && !jobManager.steps.active) {
      jobManager.steps.active = true;
      // We start the leaving process in the next tick so the app has enough time to register all the leave processes
      // that belong to parentNode
      Promise.resolve().then(function () {
        jobManager.steps.forEach(function (action) {
          action();
        });
        jobManager.steps = [];
        jobManager.steps.active = false;
      });
    }
  }

  /**
   *
   * @param {RenderJobManager} jobManager
   * @returns {Galaxy.Sequence.Process}
   */
  function createWhenAllDoneProcess(jobManager) {
    const whenAllDone = function () {
      // Because the items inside queue will change on the fly we have to manually check whether all the
      // promises have resolved and if not we hav eto use Promise.all on the list again
      const allNotResolved = jobManager.queue.some(function (promise) {
        return promise.resolved !== true;
      });

      if (allNotResolved) {
        // if not all resolved, then listen to the list again
        jobManager.queue = jobManager.queue.filter(function (p) {
          return !p.resolved;
        });

        jobManager.mainPromise = Promise.all(jobManager.queue);
        jobManager.mainPromise.then(whenAllDone);
        return;
      }

      jobManager.queue = [];
      jobManager.mainPromise = null;
    };

    const process = new Galaxy.Sequence.Process();
    process.then(whenAllDone);

    jobManager.mainPromise = jobManager.mainPromise || Promise.all(jobManager.queue);
    // When all the destroy processes of all the $for inside parentNode is done
    // This make sure that $for's which are children of the same parent act as one $for
    jobManager.mainPromise.then(process.proceed);

    return process;
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param {Array.<Galaxy.View.ViewNode>} itemsToBeRemoved
   * @param {Function} onDone
   * @return {*}
   */
  function createLeaveStep(node, itemsToBeRemoved, onDone) {
    if (!itemsToBeRemoved.length) {
      return onDone;
    }

    return function $forLeaveStep() {
      const parent = node.parent;
      const parentLeaveSequence = parent.sequences.leave;
      const schema = node.schema;

      // if parent leave sequence interrupted, then make sure these items will be removed from DOM
      parentLeaveSequence.onTruncate(function $forLeaveSequenceInterruptionResolver() {
        itemsToBeRemoved.forEach(function (vn) {
          vn.sequences.leave.truncate();
          vn.detach();
        });
      });

      let alternateDOMFlow = parent.schema.renderConfig.alternateDOMFlow;
      if (schema.renderConfig.hasOwnProperty('alternateDOMFlow')) {
        alternateDOMFlow = schema.renderConfig.alternateDOMFlow;
      }

      if (alternateDOMFlow === false) {
        View.ViewNode.destroyNodes( itemsToBeRemoved, parentLeaveSequence, parentLeaveSequence);
      } else {
        View.ViewNode.destroyNodes( itemsToBeRemoved.reverse(), parentLeaveSequence, parentLeaveSequence);
      }

      parentLeaveSequence.nextAction(function () {
        parent.callLifecycleEvent('postForLeave');
        onDone();
      });
    };
  }

  function createPushProcess(node, config, changes, nodeScopeData) {
    const parentNode = node.parent;
    const positions = config.positions;
    const placeholdersPositions = [];
    let defaultPosition = null;
    let newItems = [];
    let onEachAction = function (vn) {
      this.push(vn);
    };
    parentNode.sequences.enter.onTruncate(function $forPushProcess() {
      parentNode.sequences.enter.removeByRef(node);
    });

    if (changes.type === 'push') {
      let length = config.nodes.length;

      if (length) {
        defaultPosition = config.nodes[length - 1].getPlaceholder().nextSibling;
        if (positions.length) {
          positions.forEach(function (pos) {
            const target = config.nodes[pos];
            placeholdersPositions.push(target ? target.getPlaceholder() : defaultPosition);
          });

          onEachAction = function (vn, i) {
            this.splice(i, 0, vn);
          };
        }
      } else {
        defaultPosition = node.placeholder.nextSibling;
      }

      newItems = changes.params;
      if (config.trackBy instanceof Function) {
        newItems.forEach(function (item, i) {
          config.trackMap.push(config.trackBy.call(node, item, i));
        });
      }
    } else if (changes.type === 'unshift') {
      defaultPosition = config.nodes[0] ? config.nodes[0].getPlaceholder() : null;
      newItems = changes.params;
      onEachAction = function (vn) {
        this.unshift(vn);
      };
    } else if (changes.type === 'splice') {
      let removedItems = Array.prototype.splice.apply(config.nodes, changes.params.slice(0, 2));
      newItems = changes.params.slice(2);
      removedItems.forEach(function (node) {
        node.destroy();
      });
      config.trackMap.splice(changes.params[0], changes.params[1]);
    } else if (changes.type === 'pop') {
      const lastItem = config.nodes.pop();
      lastItem && lastItem.destroy();
      config.trackMap.pop();
    } else if (changes.type === 'shift') {
      const firstItem = config.nodes.shift();
      firstItem && firstItem.destroy();
      config.trackMap.shift();
    } else if (changes.type === 'sort' || changes.type === 'reverse') {
      config.nodes.forEach(function (viewNode) {
        viewNode.destroy();
      });

      config.nodes = [];
      newItems = changes.original;
      Array.prototype[changes.type].call(config.trackMap);
    }

    let itemDataScope = nodeScopeData;
    const as = config.options.as;
    const indexAs = config.options.indexAs;
    const nodes = config.nodes;
    const templateSchema = node.cloneSchema();
    Reflect.deleteProperty(templateSchema, '$for');

    const gClone = Galaxy.clone;
    const view = node.view;
    if (newItems instanceof Array) {
      const c = newItems.slice(0);

      if (indexAs) {
        for (let i = 0, len = newItems.length; i < len; i++) {
          itemDataScope = View.createMirror(nodeScopeData);
          itemDataScope['__rootScopeData__'] = config.scope;
          itemDataScope[as] = c[i];
          itemDataScope[indexAs] = i;
          let cns = gClone(templateSchema);

          const vn = view.createNode(cns, parentNode, itemDataScope, placeholdersPositions[i] || defaultPosition, node);
          onEachAction.call(nodes, vn, positions[i]);
        }
      } else {
        // if the indexAs is not specified we run the loop without setting the for index for performance gain
        for (let i = 0, len = newItems.length; i < len; i++) {
          itemDataScope = View.createMirror(nodeScopeData);
          itemDataScope['__rootScopeData__'] = config.scope;
          itemDataScope[as] = c[i];
          let cns = gClone(templateSchema);

          const vn = view.createNode(cns, parentNode, itemDataScope, placeholdersPositions[i] || defaultPosition, node);
          onEachAction.call(nodes, vn, positions[i]);
        }
      }
    }

    parentNode.sequences.enter.nextAction(function () {
      parentNode.callLifecycleEvent('post$forEnter', newItems);
      parentNode.stream.pour('post$forEnter', 'dom childList');
    }, node);
  }
})(Galaxy);

