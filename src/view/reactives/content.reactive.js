/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['content'] = {
    type: 'reactive',
    name: 'content'
  };

  GV.REACTIVE_BEHAVIORS['content'] = {
    regex: null,
    bind: function (viewNode) {
      viewNode.toTemplate();
    },
    getCache: function (viewNode) {
      return {
        module: null,
        scope: viewNode.root.scope
      };
    },
    onApply: function (cache, viewNode, selector, matches, scopeData) {
      if (scopeData.element.schema.children && scopeData.element.schema.hasOwnProperty('module')) {
        viewNode.domManipulationSequence.next(function (done) {
          var allContent = scopeData.element.schema.children;
          var parentViewNode = viewNode.parent;
          allContent.forEach(function (content) {
            if (selector === '*' || selector.toLowerCase() === content.node.tagName.toLowerCase()) {
              content.__node__.__viewNode__.refreshBinds(scopeData);
              parentViewNode.append(content.__node__.__viewNode__, viewNode.placeholder);
              content.__node__.__viewNode__.setInDOM(true);
            }
          });

          done();
        });
      }
    }
  };
})(Galaxy.GalaxyView);

