/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['_inputs'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['_inputs'] = {
    type: 'reactive',
    key: '_inputs',
    /**
     *
     * @this {Galaxy.View.ViewNode}
     * @param value
     * @param scope
     */
    getConfig: function (scope, value) {
      if (value !== null && typeof value !== 'object') {
        throw console.error('_inputs property should be an object with explicits keys:\n', JSON.stringify(this.blueprint, null, '  '));
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
      // if (this.virtual) {
      //   return false;
      // }

      if (config.scope.data === config.subjects) {
        throw new Error('It is not allowed to use Scope.data as _input value');
      }
// debugger
//       this.inputs = G.View.bindSubjectsToData(this, config.subjects, config.scope, true);
      Object.assign(this.data, config.subjects);
// debugger
      return false;
    },
    update: function (cache, value, expression) { }
  };
})(Galaxy);
