/* global Galaxy */
(function (G) {
  const View = G.View;
  const CLONE = G.clone;
  const DESTROY_NODES = G.View.destroyNodes;

  View.REACTIVE_BEHAVIORS['repeat'] = true;
  View.NODE_BLUEPRINT_PROPERTY_MAP['repeat'] = {
    type: 'reactive',
    key: 'repeat',
    getConfig: function (scope, value) {
      this.virtualize();

      return {
        changeId: null,
        previousActionId: null,
        nodes: [],
        data: value.data,
        as: value.as,
        indexAs: value.indexAs || '_index',
        oldChanges: {},
        positions: [],
        trackMap: [],
        scope: scope,
        trackBy: value.trackBy
      };
    },

    /**
     *
     * @param config Value return by getConfig
     */
    install: function (config) {
      const viewNode = this;

      if (config.data) {
        if (config.as === 'data') {
          throw new Error('`data` is an invalid value for repeat.as property. Please choose a different value.`');
        }
        viewNode.localPropertyNames.add(config.as);
        viewNode.localPropertyNames.add(config.indexAs);

        const bindings = View.getBindings(config.data);
        if (bindings.propertyKeysPaths) {
          View.makeBinding(viewNode, 'repeat', undefined, config.scope, bindings, viewNode);
          bindings.propertyKeysPaths.forEach((path) => {
            try {
              const rd = View.propertyScopeLookup(config.scope, path);
              viewNode.finalize.push(() => {
                rd.removeNode(viewNode);
              });
            } catch (error) {
              console.error('Could not find: ' + path + '\n', error);
            }
          });
        } else if (config.data instanceof Array) {
          const setter = viewNode.setters['repeat'] = View.getPropertySetterForNode(G.View.NODE_BLUEPRINT_PROPERTY_MAP['repeat'], viewNode, config.data, null, config.scope);
          const value = new G.View.ArrayChange();
          value.params = config.data;
          config.data.changes = value;
          setter(config.data);
        }
      }

      return false;
    },

    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param config The value returned by getConfig
     * @param array
     * @param oldChanges
     * @param {Function} expression
     */
    update: function (config, array, oldChanges, expression) {
      let changes = null;
      if (expression) {
        array = expression();
        if (array === null || array === undefined) {
          return;
        }

        if (array instanceof G.View.ArrayChange) {
          changes = array;
        } else if (array instanceof Array) {
          const initialChanges = new G.View.ArrayChange();
          initialChanges.original = array;
          initialChanges.type = 'reset';
          initialChanges.params = array;
          changes = array.changes = initialChanges;
        } else {
          changes = {
            type: 'reset',
            params: []
          };
        }

        // if (!(changes instanceof Galaxy.View.ArrayChange)) {
        //   debugger;
        //   throw new Error('repeat: Expression has to return an ArrayChange instance or null \n' + config.watch.join(' , ') + '\n');
        // }
      } else {
        if (array instanceof G.View.ArrayChange) {
          changes = array;
        } else if (array instanceof Array) {
          changes = array.changes;
        }
      }

      if (changes && !(changes instanceof G.View.ArrayChange)) {
        return console.warn('%crepeat %cdata is not a type of ArrayChange' +
          '\ndata: ' + config.data +
          '\n%ctry \'' + config.data + '.changes\'\n', 'color:black;font-weight:bold', null, 'color:green;font-weight:bold');
      }

      if (!changes || typeof changes === 'string') {
        changes = {
          id: 0,
          type: 'reset',
          params: []
        };
      }

      const node = this;
      if (changes.id === config.changeId) {
        return;
      }

      // Only cancel previous action if the type of new and old changes is reset
      // if (changes.type === 'reset' && changes.type === config.oldChanges.type && config.previousActionId) {
      //   cancelAnimationFrame(config.previousActionId);
      // }

      config.changeId = changes.id;
      config.oldChanges = changes;
      // if(node.blueprint.animations && node.blueprint.animations.enter && node.blueprint.animations.enter.sequence === 'dots')debugger;
      // node.index;
      //  config.previousActionId = requestAnimationFrame(() => {
      //   prepareChanges(node, config, changes).then(finalChanges => {
      //     processChanges(node, config, finalChanges);
      //   });
      // });
      processChanges(node, config, prepareChanges(node, config, changes));
    }
  };

  function prepareChanges(viewNode, config, changes) {
    const hasAnimation = viewNode.blueprint.animations && viewNode.blueprint.animations.leave;
    const trackByKey = config.trackBy;
    if (trackByKey && changes.type === 'reset') {
      let newTrackMap;
      if (trackByKey === true) {
        newTrackMap = changes.params.map(item => {
          return item;
        });
      } else if (typeof trackByKey === 'string') {

        newTrackMap = changes.params.map(item => {
          return item[trackByKey];
        });
      }

      // list of nodes that should be removed
      const hasBeenRemoved = [];
      config.trackMap = config.trackMap.filter(function (id, i) {
        if (newTrackMap.indexOf(id) === -1 && config.nodes[i]) {
          hasBeenRemoved.push(config.nodes[i]);
          return false;
        }
        return true;
      });

      const newChanges = new G.View.ArrayChange();
      newChanges.init = changes.init;
      newChanges.type = changes.type;
      newChanges.original = changes.original;
      newChanges.params = changes.params;
      newChanges.__rd__ = changes.__rd__;
      if (newChanges.type === 'reset' && newChanges.params.length) {
        newChanges.type = 'push';
      }

      config.nodes = config.nodes.filter(function (node) {
        return hasBeenRemoved.indexOf(node) === -1;
      });

      DESTROY_NODES(hasBeenRemoved.reverse(), hasAnimation);
      return newChanges;
    } else if (changes.type === 'reset') {
      const nodesToBeRemoved = config.nodes.slice(0);
      config.nodes = [];
      DESTROY_NODES(nodesToBeRemoved.reverse(), hasAnimation);
      const newChanges = Object.assign({}, changes);
      newChanges.type = 'push';
      return newChanges;
    }

    return changes;
  }

  function processChanges(viewNode, config, changes) {
    const parentNode = viewNode.parent;
    // const positions = config.positions;
    const positions = [];
    const placeholders = [];
    const nodeScopeData = config.scope;
    const trackMap = config.trackMap;
    const as = config.as;
    const indexAs = config.indexAs;
    const nodes = config.nodes;
    const trackByKey = config.trackBy;
    const templateBlueprint = viewNode.cloneBlueprint();
    Reflect.deleteProperty(templateBlueprint, 'repeat');

    let defaultPosition = nodes.length ? nodes[nodes.length - 1].anchor.nextSibling : viewNode.placeholder.nextSibling;
    let newItems = [];
    let onEachAction;
    if (trackByKey === true) {
      onEachAction = function (vn, p, d) {
        trackMap.push(d);
        this.push(vn);
        // positions.push(vn.anchor.nextSibling);
      };
    } else {
      onEachAction = function (vn, p, d) {
        trackMap.push(d[config.trackBy]);
        this.push(vn);
        // positions.push(vn.anchor.nextSibling);
      };
    }

    if (changes.type === 'push') {
      newItems = changes.params;
    } else if (changes.type === 'unshift') {
      defaultPosition = nodes[0] ? nodes[0].anchor : defaultPosition;
      newItems = changes.params;

      if (trackByKey === true) {
        onEachAction = function (vn, p, d) {
          trackMap.unshift(d);
          this.unshift(vn);
        };
      } else {
        onEachAction = function (vn, p, d) {
          trackMap.unshift(d[trackByKey]);
          this.unshift(vn);
        };
      }
    } else if (changes.type === 'splice') {
      const changeParams = changes.params.slice(0, 2);
      const removedItems = Array.prototype.splice.apply(nodes, changeParams);
      DESTROY_NODES(removedItems.reverse(), viewNode.blueprint.animations && viewNode.blueprint.animations.leave);
      Array.prototype.splice.apply(trackMap, changeParams);

      const startingIndex = changes.params[0];
      newItems = changes.params.slice(2);
      for (let i = 0, len = newItems.length; i < len; i++) {
        const index = i + startingIndex;
        positions.push(index);
        placeholders.push(nodes[index] ? nodes[index].anchor : defaultPosition);
      }

      if (trackByKey === true) {
        onEachAction = function (vn, p, d) {
          trackMap.splice(p, 0, d);
          this.splice(p, 0, vn);
        };
      } else {
        onEachAction = function (vn, p, d) {
          trackMap.splice(p, 0, d[trackByKey]);
          this.splice(p, 0, vn);
        };
      }
    } else if (changes.type === 'pop') {
      const lastItem = nodes.pop();
      lastItem && lastItem.destroy();
      trackMap.pop();
    } else if (changes.type === 'shift') {
      const firstItem = nodes.shift();
      firstItem && firstItem.destroy();
      trackMap.shift();
    } else if (changes.type === 'sort' || changes.type === 'reverse') {
      nodes.forEach(function (viewNode) {
        viewNode.destroy();
      });

      config.nodes = [];
      newItems = changes.original;
      Array.prototype[changes.type].call(trackMap);
    }

    const view = viewNode.view;
    if (newItems instanceof Array) {
      const newItemsCopy = newItems.slice(0);
      // let vn;
      if (trackByKey) {
        if (trackByKey === true) {
          for (let i = 0, len = newItems.length; i < len; i++) {
            const newItemCopy = newItemsCopy[i];
            const index = trackMap.indexOf(newItemCopy);
            if (index !== -1) {
              config.nodes[index].data._index = index;
              continue;
            }

            // const itemDataScope = createItemDataScope(nodeScopeData, as, newItemCopy);
            // const cns = CLONE(templateBlueprint);
            // itemDataScope[indexAs] = trackMap.length;
            //
            // vn = view.createNode(cns, itemDataScope, parentNode, placeholdersPositions[i] || defaultPosition, node);
            // onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);

            createNode(view, templateBlueprint, nodeScopeData, as, newItemCopy, indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
          }
        } else {
          for (let i = 0, len = newItems.length; i < len; i++) {
            const newItemCopy = newItemsCopy[i];
            const index = trackMap.indexOf(newItemCopy[trackByKey]);
            if (index !== -1) {
              config.nodes[index].data._index = index;
              continue;
            }

            // const itemDataScope = createItemDataScope(nodeScopeData, as, newItemCopy);
            // const cns = CLONE(templateBlueprint);
            // itemDataScope[indexAs] = trackMap.length;
            //
            // vn = view.createNode(cns, itemDataScope, parentNode, placeholdersPositions[i] || defaultPosition, node);
            // onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
            createNode(view, templateBlueprint, nodeScopeData, as, newItemCopy, indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
          }
        }
      } else {
        for (let i = 0, len = newItems.length; i < len; i++) {
          // const itemDataScope = createItemDataScope(nodeScopeData, as, newItemsCopy[i]);
          // const cns = CLONE(templateBlueprint);
          // itemDataScope[indexAs] = i;
          //
          // vn = view.createNode(cns, itemDataScope, parentNode, placeholdersPositions[i] || defaultPosition, node);
          // onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
          createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy[i], indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
        }
      }

    }
  }

  function createItemDataScope(nodeScopeData, as, itemData) {
    const itemDataScope = View.createChildScope(nodeScopeData);
    itemDataScope[as] = itemData;
    return itemDataScope;
  }

  function createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy, indexAs, i, parentNode, position, onEachAction, nodes, positions) {
    const itemDataScope = createItemDataScope(nodeScopeData, as, newItemsCopy);
    const cns = CLONE(templateBlueprint);
    itemDataScope[indexAs] = i;

    const vn = view.createNode(cns, itemDataScope, parentNode, position);
    onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
  }
})(Galaxy);

