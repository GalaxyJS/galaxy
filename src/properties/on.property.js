export const on_property = {
  type: 'prop',
  key: 'on',
  /**
   *
   * @param {Galaxy.ViewNode} viewNode
   * @param events
   */
  update: function (viewNode, events) {
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
