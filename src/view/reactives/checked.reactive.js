/* global Galaxy */

(function (GV) {
  // GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
  //   type: 'reactive',
  //   name: 'checked'
  // };
  //
  // GV.REACTIVE_BEHAVIORS['checked'] = {
  //   regex: GV.BINDING_SYNTAX_REGEX,
  //   bind: function (nodeScopeData, matches) {
  //     const _this = this;
  //     let parts = matches[1].split('.');
  //     let setter = new Function('data, value', 'data.' + matches[1] + ' = value;');
  //     _this.node.addEventListener('change', function () {
  //       setter.call(null, GV.getPropertyContainer(nodeScopeData.data, parts[0]), _this.node.checked);
  //     });
  //   },
  //   onApply: function (cache, value) {
  //     if (this.node.checked === value) {
  //       return;
  //     }
  //
  //     this.node.checked = value || false;
  //   }
  // };

  GV.NODE_SCHEMA_PROPERTY_MAP['checked'] = {
    type: 'prop',
    name: 'checked',
    util: function (viewNode, prop, expression, dataObject) {
      if (expression && viewNode.schema.tag === 'input') {
        throw new Error('input.checked property does not support binding expressions ' +
          'because it must be able to change its data.\n' +
          'It uses its bound value as its `model` and expressions can not be used as model.\n');
      }

      const bindings = GV.getBindings(viewNode.schema.checked);
      const id = bindings.variableNamePaths.split('.').pop();
      viewNode.node.addEventListener('change', function () {
        dataObject[id] = viewNode.node.checked;
      });
    }
  };
})(Galaxy.GalaxyView);

