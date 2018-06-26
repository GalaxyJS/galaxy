/* global Galaxy */

(function () {
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
        propName: matches.as || matches[1],
        trackMap: [],
        positions: [],
        nodes: [],
        scope: scope,
        matches: matches,
        trackBy: matches.trackBy,
        onDone: function () { }
      };
    },
    /**
     *
     * @param config Return of prepare method
     */
    install: function (config) {
      const node = this;
      const parentNode = node.parent;
      parentNode.cache.mainChildForQueue = parentNode.cache.mainChildForQueue || [];
      parentNode.cache.mainChildForLeaveProcesses = parentNode.cache.mainChildForLeaveProcesses || [];

      if (config.matches instanceof Array) {
        View.makeBinding(this, '$for', undefined, config.scope, {
          isExpression: false,
          modifiers: null,
          propertyKeysPaths: [config.matches[2] + '.changes']
        }, this);
      } else if (config.matches) {
        const bindings = View.getBindings(config.matches.data);
        config.watch = bindings.propertyKeysPaths;
        if (bindings.propertyKeysPaths) {
          View.makeBinding(node, '$for', undefined, config.scope, bindings, node);
          node.cache._skipPropertyNames.push(config.matches.as);
          bindings.propertyKeysPaths.forEach(function (path) {
            try {
              const rd = View.propertyScopeLookup(config.scope, path);
              node.addDependedObject(rd, node);
            } catch (error) {
              console.error('Could not find: ' + path + '\n', error);
            }
          });
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
      const parentNode = node.parent;
      const parentSchema = parentNode.schema;
      let newTrackMap = [];

      // Truncate on reset or actions that does not change the array length
      if (changes.type === 'reset' || changes.type === 'reverse' || changes.type === 'sort') {
        node.renderingFlow.truncate();
        node.renderingFlow.onTruncate(function () {
          config.onDone.ignore = true;
        });
      }

      const waitStepDone = registerWaitStep(parentNode.cache);
      let leaveProcess = null;
      if (config.trackBy instanceof Function) {
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
        leaveProcess = createLeaveProcess(node, config.nodes, config, function () {
          changes = Object.assign({}, changes);
          changes.type = 'push';
          waitStepDone();
        });
      } else {
        Promise.resolve().then(waitStepDone);
      }

      // leave process will be empty if the type is not reset
      if (leaveProcess) {
        if (parentSchema.renderConfig && parentSchema.renderConfig.domManipulationOrder === 'cascade') {
          parentNode.cache.mainChildForLeaveProcesses.push(leaveProcess);
        } else {
          parentNode.cache.mainChildForLeaveProcesses.unshift(leaveProcess);
        }
      }

      activateLeaveProcess(parentNode.cache);

      const whenAllDestroysAreDone = createWhenAllDoneProcess(parentNode.cache, function () {
        config.trackMap = newTrackMap;
        if (changes.type === 'reset' && changes.params.length === 0) {
          return;
        }

        createPushProcess(node, config, changes, config.scope);
      });
      config.onDone = whenAllDestroysAreDone;

      parentNode.cache.mainChildrenForPromise =
        parentNode.cache.mainChildrenForPromise || Promise.all(parentNode.cache.mainChildForQueue);
      // When all the destroy processes of all the $for inside parentNode is done
      // This make sure that $for's which are children of the same parent act as one $for
      parentNode.cache.mainChildrenForPromise.then(whenAllDestroysAreDone);
    }
  };

  /**
   *
   * @param parentCache
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

    parentCache.mainChildForQueue.push(waitForDestroy);

    return destroyDone;
  }

  function activateLeaveProcess(parentCache) {
    if (parentCache.mainChildForLeaveProcesses.length && !parentCache.mainChildForLeaveProcesses.active) {
      parentCache.mainChildForLeaveProcesses.active = true;
      // We start the leaving process in the next frame so the app has enough time to register all the leave processes
      // that belong to parentNode
      Promise.resolve().then(function () {
        parentCache.mainChildForLeaveProcesses.forEach(function (action) {
          action();
        });
        parentCache.mainChildForLeaveProcesses = [];
        parentCache.mainChildForLeaveProcesses.active = false;
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
    const whenAllDestroysAreDone = function () {
      if (whenAllDestroysAreDone.ignore) {
        return;
      }
      // Because the items inside mainChildForQueue will change on the fly we have manually check whether all the
      // promises have resolved and if not we hav eto use Promise.all on the list again
      const allNotResolved = parentCache.mainChildForQueue.some(function (promise) {
        return promise.resolved !== true;
      });

      if (allNotResolved) {
        // if not all resolved, then listen to the list again
        parentCache.mainChildForQueue = parentCache.mainChildForQueue.filter(function (p) {
          return !p.resolved;
        });

        parentCache.mainChildrenForPromise = Promise.all(parentCache.mainChildForQueue);
        parentCache.mainChildrenForPromise.then(whenAllDestroysAreDone);
        return;
      }

      parentCache.mainChildrenForPromise = null;
      callback();
    };

    return whenAllDestroysAreDone;
  }

  function createLeaveProcess(node, itemsToBeRemoved, config, onDone) {
    return function () {
      const parentNode = node.parent;
      const schema = node.schema;
      node.renderingFlow.next(function leaveProcess(next) {
        if (itemsToBeRemoved.length) {
          let domManipulationOrder = parentNode.schema.renderConfig.domManipulationOrder;
          if (schema.renderConfig.domManipulationOrder) {
            domManipulationOrder = schema.renderConfig.domManipulationOrder;
          }

          if (domManipulationOrder === 'cascade') {
            View.ViewNode.destroyNodes(node, itemsToBeRemoved, null, parentNode.sequences.leave);
          } else {
            View.ViewNode.destroyNodes(node, itemsToBeRemoved.reverse());
          }

          parentNode.sequences.leave.nextAction(function () {
            parentNode.callLifecycleEvent('postForLeave');
            onDone();
            next();
          });
        } else {
          onDone();
          next();
        }
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
    parentNode.sequences.enter.onTruncate(function () {
      parentNode.sequences.enter.removeByRef(node);
    });

    node.renderingFlow.next(function forPushProcess(next) {
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
      } else if (changes.type === 'pop') {
        config.nodes.pop().destroy();
      } else if (changes.type === 'shift') {
        config.nodes.shift().destroy();
      } else if (changes.type === 'sort' || changes.type === 'reverse') {
        config.nodes.forEach(function (viewNode) {
          viewNode.destroy();
        });

        config.nodes = [];
        newItems = changes.original;
      }

      let itemDataScope = nodeScopeData;
      const pn = config.propName;
      const nodes = config.nodes;
      const templateSchema = node.cloneSchema();
      Reflect.deleteProperty(templateSchema, '$for');

      const gClone = Galaxy.clone;
      const vCreateNode = View.createNode;
      if (newItems instanceof Array) {
        const c = newItems.slice(0);
        for (let i = 0, len = newItems.length; i < len; i++) {
          itemDataScope = View.createMirror(nodeScopeData);
          itemDataScope[pn] = c[i];
          itemDataScope['$forIndex'] = i;
          let cns = gClone(templateSchema);

          const vn = vCreateNode(parentNode, itemDataScope, cns, placeholdersPositions[i] || defaultPosition, node);
          onEachAction.call(nodes, vn, positions[i]);
        }
      }

      // remove the animation from the parent which are referring to node
      // TODO: All actions related to the for nodes will be removed.
      // But this action wont get removed because it does not have a proper reference

      parentNode.sequences.enter.nextAction(function () {
        parentNode.callLifecycleEvent('postForEnter');
        next();
      }, node);
    });
  }
})(Galaxy.View);

