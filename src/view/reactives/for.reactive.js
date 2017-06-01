/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (viewNode, nodeScopeData, matches) {
      viewNode.toTemplate();
      viewNode.root.makeBinding(viewNode, nodeScopeData, '$for', matches[2]);
    },
    getCache: function (matches) {
      return {
        propName: matches[1],
        clonedNodeSchema: null,
        nodes: []
      };
    },
    onApply: function (cache, viewNode, changes, matches, nodeScopeData) {
      cache.clonedNodeSchema = cache.clonedNodeSchema || viewNode.cloneSchema();
      cache.clonedNodeSchema.$for = null;
      var parentNode = viewNode.placeholder.parentNode;
      var position = null;
      var newItems = [];
      var action = Array.prototype.push;

      if (changes.type === 'push') {
        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = cache.nodes[0] ? cache.nodes[0].node : null;
        newItems = changes.params;
        action = Array.prototype.unshift;
      } else if (changes.type === 'splice') {
        var removedItems = Array.prototype.splice.apply(cache.nodes, changes.params.slice(0, 2));
        newItems = changes.params.slice(2);
        removedItems.forEach(function (viewNode) {
          viewNode.destroy();
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

      var valueEntity, itemDataScope = Object.assign({}, nodeScopeData);
      var p = cache.propName, n = cache.nodes, vr = viewNode.root, cns = cache.clonedNodeSchema;

      // Galaxy.GalaxyView.nextTick(function () {
      if (newItems instanceof Array) {
        for (var i = 0, len = newItems.length; i < len; i++) {
          valueEntity = newItems[i];

          itemDataScope[p] = valueEntity;

          action.call(n, vr.append(cns, itemDataScope, parentNode, position));
        }
      } else {
        // for (var index in value) {
        //   valueEntity = value[index];
        //   if (valueEntity.__schemas__ && valueEntity.__schemas__.length/* && valueEntity.__schemas__.filter(filter).length*/) {
        //     continue;
        //   }
        //
        //   itemDataScope = nodeScopeData;
        //   itemDataScope[propName] = valueEntity;
        //   this.append(newNodeSchema, itemDataScope, parentNode);
        // }
      }
      // });
    }
  };
})(Galaxy.GalaxyView);

