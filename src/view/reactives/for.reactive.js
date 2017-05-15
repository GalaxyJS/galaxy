/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (viewNode, nodeScopeData, matches) {
      viewNode.toTemplate();
      this.makeBinding(viewNode, nodeScopeData, 'reactive_for', matches[2]);
    },
    onApply: function (viewNode, changes, matches, nodeScopeData) {
      var _this = this;
      var propName = matches[1];
      var newNodeSchema = viewNode.cloneSchema();
      newNodeSchema.reactive.for = null;
      var parentNode = viewNode.placeholder.parentNode;
      var position = null;
      var newItems = [];
      var forCachedItems = [];

      if (!viewNode.cache.for) {
        viewNode.cache.for = forCachedItems;
      } else {
        forCachedItems = viewNode.cache.for;
      }

      var action = forCachedItems.push;

      if (changes.type === 'push') {
        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = forCachedItems[0] ? forCachedItems[0].node : null;
        newItems = changes.params;
        action = forCachedItems.unshift;
      } else if (changes.type === 'splice') {
        var removedItems = Array.prototype.splice.apply(forCachedItems, changes.params.slice(0, 2));
        newItems = changes.params.slice(2);
        removedItems.forEach(function (viewNode) {
          viewNode.destroy();
        });
      } else if (changes.type === 'pop') {
        forCachedItems.pop().destroy();
      } else if (changes.type === 'shift') {
        forCachedItems.shift().destroy();
      } else if (changes.type === 'sort' || changes.type === 'reverse') {
        forCachedItems.forEach(function (viewNode) {
          viewNode.destroy();
        });

        forCachedItems = [];
        newItems = changes.original;
      }

      var valueEntity;
      if (newItems instanceof Array) {
        for (var i = 0, len = newItems.length; i < len; i++) {
          valueEntity = newItems[i];

          var itemDataScope = Object.assign({}, nodeScopeData);
          itemDataScope[propName] = valueEntity;

          action.call(forCachedItems, _this.append(newNodeSchema, itemDataScope, parentNode, position));
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
    }
  };
})(Galaxy.GalaxyView);

