/* global Galaxy */

(function () {
  const View = Galaxy.View;
  View.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  View.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    prepareData: function (matches, scope) {
      this.virtualize();

      return {
        propName: matches.as || matches[1],
        trackMap: [],
        positions: [],
        nodes: [],
        scope: scope,
        matches: matches,
        trackBy: matches.trackBy
      };
    },
    /**
     *
     * @param config Return of prepareData method
     */
    install: function (config) {
      if (config.matches instanceof Array) {
        View.makeBinding(this, '$for', undefined, config.scope, {
          isExpression: false,
          modifiers: null,
          propertyKeysPaths: [config.matches[2] + '.changes']
        }, this);
      } else if (config.matches) {
        const _this = this;
        const bindings = View.getBindings(config.matches.data);
        config.watch = bindings.propertyKeysPaths;
        if (bindings.propertyKeysPaths) {
          // if (bindings.propertyKeysPaths.length === 1 && bindings.propertyKeysPaths[0].indexOf('.changes') === -1) {
          //   bindings.propertyKeysPaths[0] = bindings.propertyKeysPaths[0] + '.changes';
          // }

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
      const parentNode = _this.parent;
      parentNode.cache._mainForLeaveQueue = parentNode.cache._mainForLeaveQueue || [];

      if (config.trackBy instanceof Function) {
        // _this.renderingFlow.truncate();
        _this.renderingFlow.next(function (nextStep) {
          const newTrackMap = changes.params.map(function (item, i) {
            return config.trackBy.call(_this, item, i);
          });

          // list of nodes that should be removed
          const hasBeenRemoved = [];
          config.trackMap.forEach(function (id, i) {
            if (newTrackMap.indexOf(id) === -1 && config.nodes[i]) {
              hasBeenRemoved.push(config.nodes[i]);
            }
          });

          if (hasBeenRemoved.length) {
            config.nodes = config.nodes.filter(function (node) {
              return hasBeenRemoved.indexOf(node) === -1;
            });

            let destroyDone;
            const destroyProcess = new Promise(function (resolve) {
              destroyDone = function () {
                destroyProcess.resolved = true;
                resolve();
              };
            });

            parentNode.cache._mainForLeaveQueue.push(destroyProcess);
            // _this.renderingFlow.truncate();
            // _this.renderingFlow.next(function forResetProcess(next) {
            if (_this.schema.renderConfig && _this.schema.renderConfig.domManipulationOrder === 'cascade') {
              View.ViewNode.destroyNodes(_this, hasBeenRemoved, null, parentNode.sequences.leave);
            } else {
              View.ViewNode.destroyNodes(_this, hasBeenRemoved.reverse());
            }

            parentNode.sequences.leave.nextAction(function () {
              parentNode.callLifecycleEvent('postLeave');
              parentNode.callLifecycleEvent('postAnimations');
              // next();
              destroyDone();
            });
            // });
          }

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
          changes = newChanges;
          config.trackMap = newTrackMap;
          debugger

          // Don't process if the is no new parameter. The list has been shrank
          if (!newChanges.params.length) {
            return nextStep();
          }
          // When some old items have been removed and also some new items have been added
          else if (newChanges.type === 'reset') {
            newChanges.type = 'push';
          }

          const mainForQ = parentNode.cache._mainForLeaveQueue;
          if (mainForQ.length) {
            const whenAllDone = function () {
              // Because the items inside _mainForLeaveQueue will change on the fly we have manually check whether all the
              // promises have resolved and if not we hav eto use Promise.all on the list again
              const allNotResolved = mainForQ.some(function (promise) {
                return promise.resolved !== true;
              });

              if (allNotResolved) {
                // if not all resolved, then listen to the list again
                Promise.all(mainForQ).then(whenAllDone);
                return;
              }

              mainForQ.splice(0);
              // _this.renderingFlow.truncate();

              debugger;
              nextStep();
              // createPushProcess(_this, config, changes, config.scope);
            };

            Promise.all(mainForQ).then(whenAllDone);
          } else {

            debugger
            nextStep();
            // _this.renderingFlow.truncate();

          }
          debugger;
        });

        _this.renderingFlow.nextAction(function () {
          debugger;
          createPushProcess(_this, config, changes, config.scope);
        });
      } else {
        // _this.renderingFlow.truncate();
        runForProcess(_this, config, changes, config.scope);
      }
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param config
   * @param changes
   * @param nodeScopeData
   */
  const runForProcess = function (node, config, changes, nodeScopeData) {
    if (changes.type === 'reset') {
      node.renderingFlow.next(function forResetProcess(next) {
        if (config.nodes.length) {
          if (node.schema.renderConfig && node.schema.renderConfig.domManipulationOrder === 'cascade') {
            View.ViewNode.destroyNodes(node, config.nodes, null, node.parent.sequences.leave);
          } else {
            View.ViewNode.destroyNodes(node, config.nodes.reverse());
          }

          config.nodes = [];
          node.parent.sequences.leave.nextAction(function () {
            node.parent.callLifecycleEvent('postLeave');
            node.parent.callLifecycleEvent('postAnimations');
            next();
          });
        } else {
          next();
        }
      });

      changes = Object.assign({}, changes);
      changes.type = 'push';

      if (changes.params.length) {
        createPushProcess(node, config, changes, nodeScopeData);
      }
    } else {
      createPushProcess(node, config, changes, nodeScopeData);
    }
  };

  const createPushProcess = function (node, config, changes, nodeScopeData) {
    const parentNode = node.parent;
    const positions = config.positions;
    const placeholdersPositions = [];
    let defaultPosition = null;
    let newItems = [];
    let onEachAction = function (vn) {
      this.push(vn);
    };

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
        console.info('p', parentNode);
        parentNode.callLifecycleEvent('postAnimations');
        next();
      });
    });
    // We check for domManipulationsBus in the next ui action so we can be sure all the dom manipulations have been set
    // on parentNode.domManipulationsBus. For example in the case of nested $for, there is no way of telling that
    // all the dom manipulations are set in a ui action, so we need to do that in the next ui action.
    // parentNode.renderingFlow.next(function (next) {
    // setTimeout(function () {
    // Promise.all(parentNode.domBus).then(next);
    // });
    // });
  };
})(Galaxy.View);

