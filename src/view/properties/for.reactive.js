/* global Galaxy */

(function (Galaxy) {
  const View = Galaxy.View;
  View.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  View.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    prepare: function (matches, scope) {
      this.virtualize();

      return {
        as: matches.as || matches[1],
        indexAs: matches.indexAs,
        trackMap: [],
        positions: [],
        nodes: [],
        scope: scope,
        matches: matches,
        trackBy: matches.trackBy,
        onDone: function () { },
        oldChanges: {}
      };
    },
    /**
     *
     * @param config Return of prepare method
     */
    install: function (config) {
      const node = this;
      const parentNode = node.parent;
      parentNode.cache.$for = parentNode.cache.$for || {leaveProcessList: [], queue: [], mainPromise: null};

      if (config.matches instanceof Array) {
        View.makeBinding(this, '$for', undefined, config.scope, {
          isExpression: false,
          modifiers: null,
          propertyKeysPaths: [config.matches[2] + '.changes']
        }, this);
      } else if (config.matches) {
        const bindings = View.getBindings(config.matches.data);
        config.watch = bindings.propertyKeysPaths;
        node.localPropertyNames.add(config.matches.as);
        if (config.matches.indexAs) {
          node.localPropertyNames.add(config.matches.indexAs);
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
        } else if (config.matches.data instanceof Array) {
          const setter = node.setters['$for'] = View.createSetter(node, '$for', config.matches.data, null, config.scope);
          const value = new Galaxy.View.ArrayChange();
          value.params = config.matches.data;
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
        return console.warn('$for data is not a type of ArrayChange\nPassed type is ' + typeof changes, config.matches);
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

      // if (changes.ts === config.oldChanges.ts && changes.type === config.oldChanges.type) {
      //   return;
      // }

      config.oldChanges = changes;
      parent.inserted.then(function () {
        // Truncate on reset or actions that does not change the array length
        if (changes.type === 'reset' || changes.type === 'reverse' || changes.type === 'sort') {
          node.renderingFlow.truncate();
          node.renderingFlow.onTruncate(function () {
            config.onDone.ignore = true;
          });
        }

        const waitStepDone = registerWaitStep(parentCache.$for, parent);
        let leaveProcess = null;
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

          leaveProcess = createLeaveProcess(node, hasBeenRemoved, config, function () {
            changes = newChanges;
            waitStepDone();
          });

          // Map should be updated asap if the newChanges.type is reset
          if (newChanges.type === 'reset' && newChanges.params.length === 0) {
            config.trackMap = newTrackMap;
          }
        } else if (changes.type === 'reset') {
          const nodes = config.nodes.slice(0);
          config.nodes = [];

          leaveProcess = createLeaveProcess(node, nodes, config, function () {
            changes = Object.assign({}, changes);
            changes.type = 'push';
            waitStepDone();
          });
        } else {
          Promise.resolve().then(waitStepDone);
        }
        // leave process will be empty if the type is not reset
        if (leaveProcess) {
          if (parentSchema.renderConfig && parentSchema.renderConfig.alternateDOMFlow === false) {
            parentCache.$for.leaveProcessList.push(leaveProcess);
          } else {
            parentCache.$for.leaveProcessList.unshift(leaveProcess);
          }
        }

        activateLeaveProcess(parentCache.$for);

        const whenAllDestroysAreDone = createWhenAllDoneProcess(parentCache.$for, function () {
          if (newTrackMap) {
            config.trackMap = newTrackMap;
          }

          if (changes.type === 'reset' && changes.params.length === 0) {
            return;
          }

          createPushProcess(node, config, changes, config.scope);
        });
        config.onDone = whenAllDestroysAreDone;

        parentCache.$for.mainPromise =
          parentCache.$for.mainPromise || Promise.all(parentCache.$for.queue);
        // When all the destroy processes of all the $for inside parentNode is done
        // This make sure that $for's which are children of the same parent act as one $for
        parentCache.$for.mainPromise.then(whenAllDestroysAreDone);
      });
    }
  };

  /**
   *
   * @param $forData
   * @returns {Function}
   */
  function registerWaitStep($forData, parent) {
    let destroyDone;
    const waitForDestroy = new Promise(function (resolve) {
      destroyDone = function () {
        waitForDestroy.resolved = true;
        resolve();
      };
    });

    parent.sequences.leave.onTruncate(function () {
      if (!waitForDestroy.resolved) {
        destroyDone();
      }
    });

    $forData.queue.push(waitForDestroy);
    return destroyDone;
  }

  function activateLeaveProcess(parentCache) {
    if (parentCache.leaveProcessList.length && !parentCache.leaveProcessList.active) {
      parentCache.leaveProcessList.active = true;
      // We start the leaving process in the next frame so the app has enough time to register all the leave processes
      // that belong to parentNode
      Promise.resolve().then(function () {
        parentCache.leaveProcessList.forEach(function (action) {
          action();
        });
        parentCache.leaveProcessList = [];
        parentCache.leaveProcessList.active = false;
      });
    }
  }

  /**
   *
   * @param {Object} $forData
   * @param {Function} callback
   * @returns {Function}
   */
  function createWhenAllDoneProcess($forData, callback) {
    const whenAllDestroysAreDone = function () {
      if (whenAllDestroysAreDone.ignore) {
        return;
      }
      // Because the items inside queue will change on the fly we have manually check whether all the
      // promises have resolved and if not we hav eto use Promise.all on the list again
      const allNotResolved = $forData.queue.some(function (promise) {
        return promise.resolved !== true;
      });

      if (allNotResolved) {
        // if not all resolved, then listen to the list again
        $forData.queue = $forData.queue.filter(function (p) {
          return !p.resolved;
        });

        $forData.mainPromise = Promise.all($forData.queue);
        $forData.mainPromise.then(whenAllDestroysAreDone);
        return;
      }

      $forData.queue = [];
      $forData.mainPromise = null;
      callback();
    };

    return whenAllDestroysAreDone;
  }

  function createLeaveProcess(node, itemsToBeRemoved, config, onDone) {
    return function () {
      const parent = node.parent;
      const schema = node.schema;

      // if parent leave sequence interrupted, then make sure these items will be removed from DOM
      parent.sequences.leave.onTruncate(function hjere() {
        itemsToBeRemoved.forEach(function (vn) {
          vn.sequences.leave.truncate();
          vn.detach();
        });
      });

      if (itemsToBeRemoved.length) {
        let alternateDOMFlow = parent.schema.renderConfig.alternateDOMFlow;
        if (schema.renderConfig.hasOwnProperty('alternateDOMFlow')) {
          alternateDOMFlow = schema.renderConfig.alternateDOMFlow;
        }

        if (alternateDOMFlow === false) {
          View.ViewNode.destroyNodes(node, itemsToBeRemoved, parent.sequences.leave, parent.sequences.leave);
        } else {
          View.ViewNode.destroyNodes(node, itemsToBeRemoved.reverse(), parent.sequences.leave, parent.sequences.leave);
        }

        parent.sequences.leave.nextAction(function () {
          parent.callLifecycleEvent('postForLeave');
          onDone();
        });
      } else {
        onDone();
      }
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

    // node.renderingFlow.next(function forPushProcess(next) {
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
    const as = config.as;
    const indexAs = config.indexAs;
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
      const postChildrenInsertEvent = new CustomEvent('post$forEnter', {
        detail: {
          $forItems: newItems
        }
      });
      parentNode.broadcast(postChildrenInsertEvent);
      parentNode.callLifecycleEvent('post$forEnter', newItems);
      // parentNode.stream.filter('dom').filter('childList').next('post$forEnter');
      parentNode.stream.pour('post$forEnter', 'dom childList');
    }, node);
  }
})(Galaxy);

