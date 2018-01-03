/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['content'] = {
    type: 'reactive',
    name: 'content'
  };

  GV.REACTIVE_BEHAVIORS['content'] = {
    regex: null,
    bind: function () {
      this.toTemplate();
    },
    getCache: function () {
      return {
        module: null
      };
    },
    onApply: function (cache, selector, oldSelector, scopeData) {
      if (scopeData.element.schema.children && scopeData.element.schema.hasOwnProperty('module')) {
        // this.domManipulationSequence.next(function (done) {
        let allContent = scopeData.element.schema.children;
        let parentViewNode = this.parent;
        allContent.forEach(function (content) {
          if (selector === '*' || selector.toLowerCase() === content.node.tagName.toLowerCase()) {
            content.__node__.__viewNode__.refreshBinds(scopeData);
            parentViewNode.registerChild(content.__node__.__viewNode__, this.placeholder);
            content.__node__.__viewNode__.setInDOM(true);
          }
        });

        // done();
        // });
      }
    }
  };
})(Galaxy.GalaxyView);

