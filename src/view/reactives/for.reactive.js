/* global Galaxy */

(function () {
  const View = Galaxy.View;
  View.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  View.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    getUpdateDirection: function (data) {
      // debugger;
      // if (data && data.type === 'reset' && data.params.length === 0) {
      //   return Galaxy.View.ReactiveData.UPDATE_DIRECTION_BOTTOM_UP;
      // }
      //
      // return Galaxy.View.ReactiveData.UPDATE_DIRECTION_TOP_DOWN;
    },
    prepareData: function (matches, scope) {
      this.virtualize();

      return {
        propName: matches.as || matches[1],
        trackMap: [],
        positions: [],
        nodes: [],
        scope: scope,
        matches: matches,
        trackBy: matches.trackBy,
        queue: [],
        onDone: function () {

        }
      };
    },
    /**
     *
     * @param config Return of prepareData method
     */
    install: function (config) {
      const _this = this;
      const parentNode = _this.parent;
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
          View.makeBinding(_this, '$for', undefined, config.scope, bindings, _this);
          bindings.propertyKeysPaths.forEach(function (path) {
            try {
              const rd = View.propertyScopeLookup(config.scope, path);
              _this.addDependedObject(rd, _this);
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
     * @param config The return of prepareData
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

      const _this = this;
      const schema = _this.schema;
      const parentNode = _this.parent;
      // parentNode.cache.mainChildForQueue = parentNode.cache.mainChildForQueue || [];

      _this.renderingFlow.truncate();
      _this.renderingFlow.onTruncate(function () {
        config.onDone.ignore = true;
        config.queue = [];
      });

      let destroyDone;
      const waitForDestroy = new Promise(function (resolve) {
        destroyDone = function () {
          waitForDestroy.resolved = true;
          resolve();
        };
      });

      parentNode.cache.mainChildForQueue.push(waitForDestroy);
      config.queue.push(waitForDestroy);
      let leaveProcess = null;

      let newTrackMap = [];
      if (config.trackBy instanceof Function) {
        let newChanges;

        newTrackMap = changes.params.map(function (item, i) {
          return config.trackBy.call(_this, item, i);
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

        newChanges = new Galaxy.View.ArrayChange();
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

        leaveProcess = createLeaveProcess(_this, hasBeenRemoved, config, function (next) {
          changes = newChanges;

          destroyDone();
          // next();
        });
        leaveProcess.title = config.propName;
        // parentNode.cache.mainChildForLeaveProcesses.unshift(leaveProcess);
      } else if (changes.type === 'reset') {
        leaveProcess = createLeaveProcess(_this, config.nodes, config, function (next) {
          changes = Object.assign({}, changes);
          changes.type = 'push';
          // _this.renderingFlow;
// debugger

          destroyDone();
          // next();
          // debugger;
        });
        leaveProcess.title = config.propName;
        // parentNode.cache.mainChildForLeaveProcesses.unshift(leaveProcess);
      }

      // debugger
      // if (schema.renderConfig && schema.renderConfig.domManipulationOrder === 'cascade') {
      parentNode.cache.mainChildForLeaveProcesses.unshift(leaveProcess);
      // } else {
      //   parentNode.cache.mainChildForLeaveProcesses.push(leaveProcess);
      // }
      // debugger;

      if (parentNode.cache.mainChildForLeaveProcesses.length && !parentNode.cache.mainChildForLeaveProcesses.active) {
        parentNode.cache.mainChildForLeaveProcesses.active = true;
        // We start the leaving process in the next frame so the app has enough time to register all the leave processes
        // that belong to parentNode
        requestAnimationFrame(function () {
          parentNode.cache.mainChildForLeaveProcesses.forEach(function (action) {
            // debugger;
            action();
          });
          parentNode.cache.mainChildForLeaveProcesses = [];
          parentNode.cache.mainChildForLeaveProcesses.active = false;
        });
      }

      const whenAllLeavesAreDone = function () {
        if (whenAllLeavesAreDone.ignore) {
          return;
        }
        // Because the items inside mainChildForQueue will change on the fly we have manually check whether all the
        // promises have resolved and if not we hav eto use Promise.all on the list again
        const allNotResolved = parentNode.cache.mainChildForQueue.some(function (promise) {
          return promise.resolved !== true;
        });

        if (allNotResolved) {
          // if not all resolved, then listen to the list again
          parentNode.cache.mainChildForQueue = parentNode.cache.mainChildForQueue.filter(function (p) {
            return !p.resolved;
          });

          parentNode.cache.mainChildrenForPromise = Promise.all(parentNode.cache.mainChildForQueue);
          parentNode.cache.mainChildrenForPromise.then(whenAllLeavesAreDone);
          return;
        }

        parentNode.cache.mainChildrenForPromise = null;
        config.trackMap = newTrackMap;

        if (changes.type === 'reset' && changes.params.length === 0) {
          return;
        }

        createPushProcess(_this, config, changes, config.scope);
        // runForProcess(_this, config, changes, config.scope);
      };
      config.onDone = whenAllLeavesAreDone;

      parentNode.cache.mainChildrenForPromise =
        parentNode.cache.mainChildrenForPromise || Promise.all(parentNode.cache.mainChildForQueue);
      parentNode.cache.mainChildrenForPromise.then(whenAllLeavesAreDone);
    }
  };

  function createLeaveProcess(node, itemsToBeRemoved, config, onDone) {
    return function () {
      const parentNode = node.parent;
      const schema = node.schema;
      node.renderingFlow.next(function leaveProcess(next) {
        if (itemsToBeRemoved.length) {
          if (schema.renderConfig && schema.renderConfig.domManipulationOrder === 'cascade') {
            View.ViewNode.destroyNodes(node, itemsToBeRemoved, null, parentNode.sequences.leave);
          } else {
            View.ViewNode.destroyNodes(node, itemsToBeRemoved.reverse());
          }

          parentNode.sequences.leave.nextAction(function () {
            parentNode.callLifecycleEvent('postLeave');
            parentNode.callLifecycleEvent('postAnimations');
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
// debugger;
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

      // const listPlaceholder = node.placeholder;
      // if (listPlaceholder.parentNode !== parentNode.node) {
      // parentNode.contentRef = listPlaceholder.parentNode;
      // }

      const gClone = Galaxy.clone;
      const vCreateNode = View.createNode;
      if (newItems instanceof Array) {
        const c = newItems.slice(0);
        for (let i = 0, len = newItems.length; i < len; i++) {
          itemDataScope = View.createMirror(nodeScopeData);
          itemDataScope[pn] = c[i];
          itemDataScope['$forIndex'] = i;
          let cns = gClone(templateSchema);

          const vn = vCreateNode(parentNode, itemDataScope, cns, placeholdersPositions[i] || defaultPosition);
          onEachAction.call(nodes, vn, positions[i]);
        }
      }

      parentNode.sequences.enter.nextAction(function () {
        parentNode.callLifecycleEvent('postEnter');
        parentNode.callLifecycleEvent('postAnimations');
        next();
      });
    });

  };
})(Galaxy.View);

