/* global Galaxy */
(function (G) {
  const View = G.View;
  const CLONE = G.clone;
  const DESTROY_NODES = G.View.destroyNodes;
  const CREATE_IN_NEXT_FRAME = G.View.CREATE_IN_NEXT_FRAME;

  View.REACTIVE_BEHAVIORS['repeat'] = true;
  View.NODE_BLUEPRINT_PROPERTY_MAP['repeat'] = {
    type: 'reactive',
    name: 'repeat',
    prepare: function (scope, value) {
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
     * @param config Return of prepare method
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
          const setter = viewNode.setters['repeat'] = View.assignSetter(viewNode, 'repeat', config.data, null, config.scope);
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
     * @param config The return of prepare
     * @param array
     * @param oldChanges
     * @param {Function} expression
     */
    apply: function (config, array, oldChanges, expression) {
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
      if (changes.type === 'reset' && changes.type === config.oldChanges.type && config.previousActionId) {
        cancelAnimationFrame(config.previousActionId);
      }

      config.changeId = changes.id;
      config.oldChanges = changes;
      config.previousActionId = requestAnimationFrame(() => {
        prepareChanges(node, config, changes).then(finalChanges => {
          processChages(node, config, finalChanges);
        });
      });
    }
  };

  async function prepareChanges(viewNode, config, changes) {
    const hasAnimation = viewNode.blueprint.animations && viewNode.blueprint.animations.leave;

    if (typeof config.trackBy === 'string' && changes.type === 'reset') {
      const trackByKey = config.trackBy;
      const newTrackMap = changes.params.map(item => {
        return item[trackByKey];
      });
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

  function processChages(node, config, changes) {
    const parentNode = node.parent;
    const positions = config.positions;
    const nodeScopeData = config.scope;
    const trackMap = config.trackMap;
    const placeholdersPositions = [];
    const as = config.as;
    const indexAs = config.indexAs;
    const nodes = config.nodes;
    const trackByKey = config.trackBy;
    const templateBlueprint = node.cloneBlueprint();
    Reflect.deleteProperty(templateBlueprint, 'repeat');

    let defaultPosition = null;
    let newItems = [];
    let onEachAction = function (vn, p, d) {
      trackMap.push(d[config.trackBy]);
      this.push(vn);
    };

    if (changes.type === 'push') {
      let length = config.nodes.length;

      if (length) {
        defaultPosition = config.nodes[length - 1].anchor.nextSibling;
        if (positions.length) {
          positions.forEach(function (pos) {
            const target = config.nodes[pos];
            placeholdersPositions.push(target ? target.anchor : defaultPosition);
          });

          onEachAction = function (vn, p, d) {
            trackMap.splice(p, 0, d[config.trackBy]);
            this.splice(p, 0, vn);
          };
        }
      } else {
        defaultPosition = node.placeholder.nextSibling;
      }

      newItems = changes.params;
    } else if (changes.type === 'unshift') {
      defaultPosition = config.nodes[0] ? config.nodes[0].anchor : null;
      newItems = changes.params;
      onEachAction = function (vn, p, d) {
        trackMap.unshift(d[config.trackBy]);
        this.unshift(vn);
      };
    } else if (changes.type === 'splice') {
      let removedItems = Array.prototype.splice.apply(config.nodes, changes.params.slice(0, 2));
      newItems = changes.params.slice(2);
      removedItems.forEach(function (node) {
        node.destroy();
      });
      trackMap.splice(changes.params[0], changes.params[1]);
    } else if (changes.type === 'pop') {
      const lastItem = config.nodes.pop();
      lastItem && lastItem.destroy();
      trackMap.pop();
    } else if (changes.type === 'shift') {
      const firstItem = config.nodes.shift();
      firstItem && firstItem.destroy();
      trackMap.shift();
    } else if (changes.type === 'sort' || changes.type === 'reverse') {
      config.nodes.forEach(function (viewNode) {
        viewNode.destroy();
      });

      config.nodes = [];
      newItems = changes.original;
      Array.prototype[changes.type].call(trackMap);
    }

    const view = node.view;
    if (newItems instanceof Array) {
      const newItemsCopy = newItems.slice(0);
      let vn;
      if (trackByKey) {
        for (let i = 0, len = newItems.length; i < len; i++) {
          const newItemCopy = newItemsCopy[i];
          const index = trackMap.indexOf(newItemCopy[trackByKey]);
          if (index !== -1) {
            config.nodes[index].data._index = index;
            continue;
          }

          const itemDataScope = createItemDataScope(nodeScopeData, as, newItemCopy);
          const cns = CLONE(templateBlueprint);
          itemDataScope[indexAs] = trackMap.length;

          vn = view.createNode(cns, parentNode, itemDataScope, placeholdersPositions[i] || defaultPosition, node);
          onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
        }
      } else {
        for (let i = 0, len = newItems.length; i < len; i++) {
          const itemDataScope = createItemDataScope(nodeScopeData, as, newItemsCopy[i]);
          let cns = CLONE(templateBlueprint);
          itemDataScope[indexAs] = i;

          vn = view.createNode(cns, parentNode, itemDataScope, placeholdersPositions[i] || defaultPosition, node);
          onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
        }
      }

    }
  }

  function createItemDataScope(nodeScopeData, as, itemData) {
    const itemDataScope = View.createChildScope(nodeScopeData);
    itemDataScope[as] = itemData;
    return itemDataScope;
  }
})(Galaxy);

