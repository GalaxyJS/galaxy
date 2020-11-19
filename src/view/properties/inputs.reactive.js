/* global Galaxy */
(function (G) {
  G.View.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  G.View.REACTIVE_BEHAVIORS['inputs'] = {
    regex: null,
    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param matches
     * @param scope
     */
    prepare: function (matches, scope) {
      if (matches !== null && typeof matches !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }

      return {
        subjects: matches,
        scope: scope
      };
    },
    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param data
     * @return {boolean}
     */
    install: function (data) {
      if (this.virtual) {
        return;
      }

      this.inputs = G.View.bindSubjectsToData(this, data.subjects, data.scope, true);

      return false;
    },
    apply: function (cache, value, oldValue, context) { }
  };
})(Galaxy);
