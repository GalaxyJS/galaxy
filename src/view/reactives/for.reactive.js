/* global Galaxy */

(function (GV) {
  GV.REACTIVE_BEHAVIORS['for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    bind: function (viewNode, nodeScopeData, matches) {
      viewNode.toTemplate();
      this.makeBinding(viewNode, nodeScopeData, 'reactive_for', matches[2]);
    },
    onApply: function (viewNode, value, matches, nodeScopeData) {
      // var oldItems = viewNode.forItems || [];
      // var newItems = [];


      // debugger;
      // oldItems.forEach(function (node) {
      //   node.destroy();
      // });
// debugger;
      var propName = matches[1];
      var newNodeSchema = viewNode.cloneSchema();
//       // newNodeSchema.inDOM = false;
      newNodeSchema.reactive.for = null;
      var parentNode = viewNode.placeholder.parentNode;
      // var predefined = Object.assign({}, nodeScopeData);
      // predefined[propName] = null;

      // var itemDataScope;

      if (value instanceof Array) {
        for (var i = 0, len = value.length; i < len; i++) {
          var valueEntity = value[i];
          if (valueEntity.__schemas__ && valueEntity.__schemas__.indexOf(viewNode) !== -1) {
            continue;
          }

          var itemDataScope =  nodeScopeData;
          itemDataScope[propName] = valueEntity;
          // debugger;
          // console.info(i , itemDataScope)
          this.append(newNodeSchema, itemDataScope, parentNode);
        }
      } else {
        for (var index in value) {
          var valueEntity = value[index];
          if (valueEntity.__schemas__ && valueEntity.__schemas__.length/* && valueEntity.__schemas__.filter(filter).length*/) {
            continue;
          }

          itemDataScope = nodeScopeData;
          itemDataScope[propName] = valueEntity;
          this.append(newNodeSchema, itemDataScope, parentNode);
        }
      }

      // viewNode.forItems = newItems;
    }
  };
})(Galaxy.GalaxyView);

