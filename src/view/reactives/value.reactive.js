/* global Galaxy */

(function (GV) {
  // GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
  //   type: 'reactive',
  //   name: 'value'
  // };
  //
  // GV.REACTIVE_BEHAVIORS['value'] = {
  //   regex: GV.BINDING_SYNTAX_REGEX,
  //   bind: function (nodeScopeData, matches) {
  //     let b = GV.getBindings(matches);
  //     arguments
  //     debugger;
  //     if (this.node.type === 'text') {
  //
  //       const _this = this;
  //       let data = nodeScopeData;
  //       let propertyName = matches[1];
  //       let parts = propertyName.split('.');
  //       if (parts[0] === 'Scope') {
  //         propertyName = parts.slice(1).join('.');
  //       } else if (parts[0] === 'this') {
  //         propertyName = parts.slice(1).join('.');
  //         data = _this.data;
  //       }
  //
  //       let setter = new Function('data, value', 'data.' + propertyName + ' = value;');
  //       _this.node.addEventListener('keyup', function () {
  //         setter.call(null, GV.getPropertyContainer(data, propertyName), _this.node.value);
  //       });
  //     }
  //   },
  //   onApply: function (cache, value) {
  //     if (document.activeElement === this.node && this.node.value === value) {
  //       return;
  //     }
  //
  //     this.node.value = value || '';
  //   }
  // };
  GV.NODE_SCHEMA_PROPERTY_MAP['value'] = {
    type: 'prop',
    util: function (viewNode, prop, expression, dataObject) {
      if (expression) {
        throw new Error('value property can not be bound to an expression');
      }
      let bindings = GV.getBindings(viewNode.schema.value);

      let id = bindings.variableNamePaths.split('.').pop()
      // let setter = new Function('data, value', 'data.' + bindings.variableNamePaths + ' = value;');
      debugger;
      console.info(dataObject)
      viewNode.node.addEventListener('keyup', function () {
        dataObject[id] = viewNode.node.value;
        // setter.call(null, GV.getPropertyContainer(data, propertyName), _this.node.value);
      });
    }
  };
})(Galaxy.GalaxyView);

