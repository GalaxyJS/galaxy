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
     * @param scopeData
     * @param value
     */
    bind: function (scopeData, value) {
      if (value !== null && typeof  value !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }
    },
    onApply: function (cache, value, oldValue, context) {
      if (this.virtual) return;

      let live = GV.bindSubjectsToData(value, context, true);

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
