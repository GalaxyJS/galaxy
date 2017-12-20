/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  GV.REACTIVE_BEHAVIORS['inputs'] = {
    regex: null,
    /**
     *
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param context
     * @param value
     */
    bind: function (context, value) {
      if (value !== null && typeof  value !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }
      let live = GV.bindSubjectsToData(value, context, true);
      // Object.preventExtensions(live);
      // console.info(Object.isSealed(live), live);
      if(this.virtual) {
        console.info(this);
      }

      if (this.addons.inputs && live !== this.addons.inputs.live) {
        Galaxy.resetObjectTo(this.addons.inputs, {
          live: live,
          original: value
        });
      } else if (this.addons.inputs === undefined) {
        this.addons.inputs = {
          live: live,
          original: value
        };
      }

      this.inputs = live;
      this.addDependedObject(live);
    },
    onApply: function (cache, value, oldValue, context) {
    }
  };

  Galaxy.registerAddOnProvider('galaxy/inputs', function (scope) {
    return {
      create: function () {
        scope.inputs = scope.element.addons.inputs.live;

        return scope.inputs;
      },
      finalize: function () {
        // By linking the live to original we make sure that changes on the local copy of the input data will be
        // reflected to the original one
        GV.link(scope.element.addons.inputs.live, scope.element.addons.inputs.original);
      }
    };
  });
})(Galaxy.GalaxyView);
