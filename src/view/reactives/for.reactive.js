/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['$for'] = {
    type: 'reactive',
    name: '$for'
  };

  GV.REACTIVE_BEHAVIORS['$for'] = {
    regex: /^([\w]*)\s+in\s+([^\s\n]+)$/,
    prepareData: function (matches, scope) {
      this.virtualize();

      return {
        propName: matches.as || matches[1],
        nodes: [],
        scope: scope,
        matches: matches
      };
    },
    /**
     *
     * @param data Return of prepareData method
     */
    install: function (data) {
      if (data.matches instanceof Array) {
        // debugger
        GV.makeBinding(this, '$for', data.scope, {
          isExpression: false,
          modifiers: null,
          propertyKeysPaths: [data.matches[2]]
        });
        // debugger;
      } else if (data.matches) {
        const bindings = GV.getBindings(data.matches.data);
        if (bindings.propertyKeysPaths) {
          GV.makeBinding(this, '$for', data.scope, bindings);
        }
      }

      return false;
    },
    /**
     *
     * @this {Galaxy.GalaxyView.ViewNode}
     * @param data The return of prepareData
     * @param changes
     * @param oldChanges
     * @param expression
     */
    apply: function (data, changes, oldChanges, expression) {
      if(changes instanceof Array){
        debugger;
      }
      if (!changes || typeof changes === 'string') {
        changes = {
          type: 'reset',
          params: []
        };
      }

      if (expression) {
        changes.params = expression();
      }

      const _this = this;

      createResetProcess(_this, data, changes, data.scope);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param data
   * @param changes
   * @param nodeScopeData
   */
  const createResetProcess = function (node, data, changes, nodeScopeData) {
    node.renderingFlow.truncate();
    if (changes.type === 'reset') {
      node.renderingFlow.next(function forResetProcess(next) {
        GV.ViewNode.destroyNodes(node, data.nodes.reverse());
        data.nodes = [];

        node.parent.sequences.leave.nextAction(function () {
          next();
        });
      });

      changes = Object.assign({}, changes);
      changes.type = 'push';

      if (changes.params.length) {
        createPushProcess(node, data, changes, nodeScopeData);
      }
    } else {
      createPushProcess(node, data, changes, nodeScopeData);
    }
  };

  const createPushProcess = function (node, data, changes, nodeScopeData) {
    const parentNode = node.parent;
    let position = null;
    let newItems = [];
    let action = Array.prototype.push;

    node.renderingFlow.next(function forPushProcess(next) {
      if (changes.type === 'push') {
        let length = data.nodes.length;
        if (length) {
          position = data.nodes[length - 1].getPlaceholder().nextSibling;
        } else {
          position = node.placeholder.nextSibling;
        }

        newItems = changes.params;
      } else if (changes.type === 'unshift') {
        position = data.nodes[0] ? data.nodes[0].getPlaceholder() : null;
        newItems = changes.params;
        action = Array.prototype.unshift;
      } else if (changes.type === 'splice') {
        let removedItems = Array.prototype.splice.apply(data.nodes, changes.params.slice(0, 2));
        newItems = changes.params.slice(2);
        removedItems.forEach(function (node) {
          node.destroy();
        });
      } else if (changes.type === 'pop') {
        data.nodes.pop().destroy();
      } else if (changes.type === 'shift') {
        data.nodes.shift().destroy();
      } else if (changes.type === 'sort' || changes.type === 'reverse') {
        data.nodes.forEach(function (viewNode) {
          viewNode.destroy();
        });

        data.nodes = [];
        newItems = changes.original;
      }

      let itemDataScope = nodeScopeData;
      let p = data.propName, n = data.nodes, cns;
      const templateSchema = node.cloneSchema();
      Reflect.deleteProperty(templateSchema, '$for');

      if (newItems instanceof Array) {
        const c = newItems.slice(0);
        for (let i = 0, len = newItems.length; i < len; i++) {
          itemDataScope = GV.createMirror(nodeScopeData);
          itemDataScope[p] = c[i];
          itemDataScope['$forIndex'] = i;
          cns = Galaxy.clone(templateSchema);
          let vn = GV.createNode(parentNode, itemDataScope, cns, position);
          action.call(n, vn);
        }
      }

      parentNode.sequences.enter.nextAction(next);
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
})(Galaxy.GalaxyView);

