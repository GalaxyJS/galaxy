/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  GV.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (viewNode, nodeScopeData, matches) {
      viewNode.toTemplate();
      viewNode.root.makeBinding(viewNode, nodeScopeData, '$for', matches[2]);
    },
    getCache: function (viewNode, matches) {
      return {
        propName: matches[1],
        nodes: []
      };
    },
    onApply: function (cache, viewNode, changes, matches, nodeScopeData) {
      var parentNode = viewNode.parent;
      var position = null;
      var newItems = [];
      var action = Array.prototype.push;
      if (changes.type === 'reset') {
        cache.nodes.forEach(function (viewNode) {
          viewNode.destroy();
        });

        cache.nodes = [];
        changes = Object.assign({}, changes);
        changes.type = 'push';
      }

      if (changes.type === 'push') {
        var length = cache.nodes.length;
        if (length) {
          position = cache.nodes[length - 1].getPlaceholder().nextSibling;
        } else {
          position = viewNode.placeholder.nextSibling;
        }

        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = cache.nodes[0] ? cache.nodes[0].placeholder : null;
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

      var valueEntity, itemDataScope = nodeScopeData;
      var p = cache.propName, n = cache.nodes, vr = viewNode.root, cns;

      if (newItems instanceof Array) {
        for (var i = 0, len = newItems.length; i < len; i++) {
          valueEntity = newItems[i];
          itemDataScope = GV.createMirror(nodeScopeData);
          itemDataScope[p] = valueEntity;
          cns = viewNode.cloneSchema();
          delete cns.$for;
          var vn = vr.append(cns, itemDataScope, parentNode, position);
          vn.data[p] = valueEntity;
          action.call(n, vn);
        }
      }
    }
  };
})(Galaxy.GalaxyView);

