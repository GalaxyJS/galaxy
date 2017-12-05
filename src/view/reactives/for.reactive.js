/* global Galaxy */

(function (GV) {
  const createResetProcess = function (node, cache, changes, nodeScopeData) {
    if (changes.type === 'reset') {
      node.uiManipulationSequence.next(function (nextUIAction) {
        GV.ViewNode.destroyNodes(node, cache.nodes.reverse());

        const bus = node.domManipulationBus.slice(0);
        cache.nodes = [];

        Promise.all(bus).then(function () {
          nextUIAction();
        });
      });

      changes = Object.assign({}, changes);
      changes.type = 'push';
    }

    createPushProcess(node, cache, changes, nodeScopeData);
  };

  const createPushProcess = function (node, cache, changes, nodeScopeData) {
    let parentNode = node.parent;
    let position = null;
    let newItems = [];
    let action = Array.prototype.push;
    node.uiManipulationSequence.next(function (nextUIAction) {
      if (changes.type === 'push') {
        let length = cache.nodes.length;
        if (length) {
          position = cache.nodes[length - 1].getPlaceholder().nextSibling;
        } else {
          position = node.placeholder.nextSibling;
        }

        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = cache.nodes[0] ? cache.nodes[0].getPlaceholder() : null;
        newItems = changes.params;
        action = Array.prototype.unshift;
      } else if (changes.type === 'splice') {
        let removedItems = Array.prototype.splice.apply(cache.nodes, changes.params.slice(0, 2));
        newItems = changes.params.slice(2);
        removedItems.forEach(function (node) {
          node.destroy();
        });
      } else if (changes.type === 'pop') {
        cache.nodes.pop().destroy();
      } else if (changes.type === 'shift') {
        cache.nodes.shift().destroy();
      } else if (changes.type === 'sort' || changes.type === 'reverse') {
        cache.nodes.forEach(function (viewNode) {
          viewNode.destroy();
        });

        cache.nodes = [];
        newItems = changes.original;
      }

      let valueEntity, itemDataScope = nodeScopeData;
      let p = cache.propName, n = cache.nodes, cns;

      if (newItems instanceof Array) {
        for (let i = 0, len = newItems.length; i < len; i++) {
          valueEntity = newItems[i];
          itemDataScope = GV.createMirror(nodeScopeData);
          itemDataScope[p] = valueEntity;
          cns = node.cloneSchema();
          Reflect.deleteProperty(cns, '$for');

          let vn = GV.createNode(parentNode, itemDataScope, cns, position, node.domManipulationBus);

          vn.data['$for'] = {};
          vn.data['$for'][p] = valueEntity;
          action.call(n, vn);
        }
      }

      Promise.all(node.domManipulationBus).then(function () {
        nextUIAction();
      });
    });
  };

  GV.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  GV.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (nodeScopeData, matches) {
      this.toTemplate();
      GV.makeBinding(this, nodeScopeData, '$for', matches[2]);
    },
    getCache: function (matches) {
      return {
        propName: matches[1],
        nodes: []
      };
    },
    /**
     *
     * @param cache
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param changes
     * @param matches
     * @param nodeScopeData
     */
    onApply: function (cache, changes, oldChanges, nodeScopeData) {
      if (!changes || typeof changes === 'string') {
        return;
      }

      createResetProcess(this, cache, changes, nodeScopeData);
    }
  };
})(Galaxy.GalaxyView);

