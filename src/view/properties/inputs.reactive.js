/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  G.View.REACTIVE_BEHAVIORS['inputs'] = {
    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param value
     * @param scope
     */
    prepare: function (scope, value) {
      if (value !== null && typeof value !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.blueprint, null, '  '));
      }

      return {
        subjects: value,
        scope: scope
      };
    },
    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param config
     * @return {boolean}
     */
    install: function (config) {
      if (this.virtual) {
        return false;
      }

      this.inputs = G.View.bindSubjectsToData(this, config.subjects, config.scope, true);

      return false;
    },
    apply: function (cache, value, oldValue, context) { }
  };
})(Galaxy);
