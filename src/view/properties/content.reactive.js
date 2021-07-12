/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['content'] = {
    type: 'reactive',
    name: 'content'
  };

  G.View.REACTIVE_BEHAVIORS['content'] = {
    regex: null,
    prepare: function (matches, scope) {
      this.virtualize();
      return {
        module: null
      };
    },
    install: function (data) {
      return false;
    },
    apply: function (cache, selector, oldSelector, expression) {
      // if (scope.element.blueprint.children && scope.element.blueprint.hasOwnProperty('module')) {
      //   // this.domManipulationSequence.next(function (done) {
      //   let allContent = scope.element.blueprint.children;
      //   let parentViewNode = this.parent;
      //   allContent.forEach(function (content) {
      //     if (selector === '*' || selector.toLowerCase() === content.node.tagName.toLowerCase()) {
      //       content.__node__.galaxyViewNode.refreshBinds(scope);
      //       parentViewNode.registerChild(content.__node__.galaxyViewNode, this.placeholder);
      //       content.__node__.galaxyViewNode.setInDOM(true);
      //     }
      //   });
      //
      //   // done();
      //   // });
      // }
    }
  };
})(Galaxy);

