/* global Galaxy */

(function (GV) {
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
      let parentNode = this.parent;
      let position = null;
      let newItems = [];
      let action = Array.prototype.push;

      if (!changes) {
        return;
      }

      if (changes.type === 'reset') {
        let vn = null;
        for (let i = cache.nodes.length - 1; i >= 0; i--) {
          vn = cache.nodes[i];
          vn.destroy();
        }

        cache.nodes = [];
        changes = Object.assign({}, changes);
        changes.type = 'push';
      }

      if (changes.type === 'push') {
        let length = cache.nodes.length;
        if (length) {
          position = cache.nodes[length - 1].getPlaceholder().nextSibling;
        } else {
          position = this.placeholder.nextSibling;
        }

        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = cache.nodes[0] ? cache.nodes[0].placeholder : null;
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
          cns = this.cloneSchema();
          Reflect.deleteProperty(cns, '$for');
          // let vn = root.append(cns, itemDataScope, parentNode, position, viewNode.domManipulationBus);
          let vn = GV.createNode(parentNode, itemDataScope, cns, position, this.domManipulationBus);
          vn.data[p] = valueEntity;
          action.call(n, vn);
        }

        // Promise.all(viewNode.manipulationPromiseList).then(function () {
        //   // debugger;
        //   ne();
        // });
        // });
      }
    }
  };
})(Galaxy.GalaxyView);

