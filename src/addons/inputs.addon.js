/* global Galaxy */
'use strict';

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['inputs'] = {
    type: 'reactive',
    name: 'inputs'
  };

  GV.REACTIVE_BEHAVIORS['inputs'] = {
    regex: null,
    /**
     *
     * @this {Galaxy.GalaxyView.ViewNode}
     * @param context
     * @param value
     */
    prepareData: function (matches, scope) {
      if (matches !== null && typeof  matches !== 'object') {
        throw console.error('inputs property should be an object with explicits keys:\n', JSON.stringify(this.schema, null, '  '));
      }

      return {
        subjects: matches,
        scope: scope
      };
    },
    install: function (data) {
      if (this.virtual) {
        return;
      }
      const subjects = data.subjects;
      const scope = data.scope;
// debugger
      let live = GV.bindSubjectsToData(subjects, scope, true);
// debugger;
      // Object.preventExtensions(live);
      // console.info(Object.isSealed(live), live);
      // if (this.virtual) {
      //   console.info(this);
      // }

      if (this.addons.inputs && live !== this.addons.inputs.live) {
        Galaxy.resetObjectTo(this.addons.inputs, {
          live: live,
          original: subjects
        });
      } else if (this.addons.inputs === undefined) {
        this.addons.inputs = {
          live: live,
          original: subjects
        };
      }

      this.inputs = live;
      this.addDependedObject(live);
    },
    apply: function (cache, value, oldValue, context) {

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
        // GV.link(scope.element.addons.inputs.live, scope.element.addons.inputs.original);
      }
    };
  });
})(Galaxy.GalaxyView);
