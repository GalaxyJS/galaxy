/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['on'] = {
    type: 'prop',
    name: 'on',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param events
     */
    value: function (viewNode, events) {
      if (events !== null && typeof events === 'object') {
        for (let name in events) {
          if (events.hasOwnProperty(name)) {
            const handler = function (event) {
              return events[name].call(viewNode, event, viewNode.data);
            };
            viewNode.node.addEventListener(name, handler, false);
            viewNode.finalize.push(() => {
              viewNode.node.removeEventListener(name, handler, false);
            });
          }
        }
      }
    }
  };
})(Galaxy);
