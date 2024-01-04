import { clone } from '../utils.js';
import {
  create_child_scope,
  create_in_next_frame, destroy_nodes, get_bindings, get_property_setter_for_node, make_binding,
  property_rd_lookup,
} from '../view.js';
import ArrayChange from '../array-change.js';

export const repeat_property = {
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
      trackBy: value.trackBy,
      onComplete: value.onComplete
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

      const bindings = get_bindings(config.data);
      if (bindings.propertyKeys.length) {
        make_binding(viewNode, 'repeat', undefined, config.scope, bindings, viewNode);
        bindings.propertyKeys.forEach((path) => {
          try {
            const rd = property_rd_lookup(config.scope, path);
            viewNode.finalize.push(() => {
              rd.removeNode(viewNode);
            });
          } catch (error) {
            console.error('Could not find: ' + path + '\n', error);
          }
        });
      } else if (config.data instanceof Array) {
        const setter = viewNode.setters['repeat'] = get_property_setter_for_node(repeat_property, viewNode, config.data, null);
        const value = new ArrayChange();
        value.params = config.data;
        config.data.changes = value;
        setter(config.data);
      }
    }

    return false;
  },

  /**
   *
   * @this Galaxy.ViewNode
   * @param config The value returned by getConfig
   * @param value
   * @param {Function} expression
   */
  update: function (config, value, expression) {
    let changes = null;
    if (expression) {
      value = expression();
      if (value === undefined) {
        return;
      }

      if (value === null) {
        throw Error('Invalid return type: ' + value + '\nThe expression function for `repeat.data` must return an instance of Array or Galaxy.View.ArrayChange or undefined');
      }

      if (value instanceof ArrayChange) {
        changes = value;
      } else if (value instanceof Array) {
        const initialChanges = new ArrayChange();
        initialChanges.original = value;
        initialChanges.type = 'reset';
        initialChanges.params = value;
        changes = value.changes = initialChanges;
      } else if (value instanceof Object) {
        const output = Object.entries(value).map(([key, value]) => ({ key, value }));
        const initialChanges = new ArrayChange();
        initialChanges.original = output;
        initialChanges.type = 'reset';
        initialChanges.params = output;
        changes = value.changes = initialChanges;
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
      if (value instanceof ArrayChange) {
        changes = value;
      } else if (value instanceof Array) {
        changes = value.changes;
      } else if (value instanceof Object) {
        const output = Object.entries(value).map(([key, value]) => ({ key, value }));
        changes = new ArrayChange();
        changes.original = output;
        changes.type = 'reset';
        changes.params = output;
      }
    }

    if (changes && !(changes instanceof ArrayChange)) {
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

    const newChanges = new ArrayChange();
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

    destroy_nodes(hasBeenRemoved, hasAnimation);
    return newChanges;
  } else if (changes.type === 'reset') {
    const nodesToBeRemoved = config.nodes.slice(0);
    config.nodes = [];
    destroy_nodes(nodesToBeRemoved, hasAnimation);
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
  templateBlueprint.repeat = null;

  let defaultPosition = nodes.length ? nodes[nodes.length - 1].anchor.nextSibling : viewNode.placeholder.nextSibling;
  let newItems = [];
  let onEachAction;
  if (trackByKey === true) {
    onEachAction = function (vn, p, d) {
      trackMap.push(d);
      this.push(vn);
    };
  } else if (typeof trackByKey === 'string') {
    onEachAction = function (vn, p, d) {
      trackMap.push(d[config.trackBy]);
      this.push(vn);
    };
  } else {
    onEachAction = function (vn) {
      this.push(vn);
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
    destroy_nodes(removedItems.reverse(), viewNode.blueprint.animations && viewNode.blueprint.animations.leave);
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

          createNode(view, templateBlueprint, nodeScopeData, as, newItemCopy, indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
        }
      }
    } else {
      for (let i = 0, len = newItems.length; i < len; i++) {
        createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy[i], indexAs, i, parentNode, placeholders[i] || defaultPosition, onEachAction, nodes, positions);
      }
    }

    if (config.onComplete) {
      create_in_next_frame(viewNode.index, (_next) => {
        config.onComplete(nodes);
        _next();
      });
    }
  }
}

function createItemDataScope(nodeScopeData, as, itemData) {
  const itemDataScope = create_child_scope(nodeScopeData);
  itemDataScope[as] = itemData;
  return itemDataScope;
}

function createNode(view, templateBlueprint, nodeScopeData, as, newItemsCopy, indexAs, i, parentNode, position, onEachAction, nodes, positions) {
  const itemDataScope = createItemDataScope(nodeScopeData, as, newItemsCopy);
  const cns = clone(templateBlueprint);
  itemDataScope[indexAs] = i;

  const vn = view.createNode(cns, itemDataScope, parentNode, position);
  onEachAction.call(nodes, vn, positions[i], itemDataScope[as]);
}

