import Observer from '../observer.js';
import { bind_subjects_to_data } from '../view.js';

function apply_node_dataset(node, value) {
  if (typeof value === 'object' && value !== null) {
    const stringifyValue = {};
    for (const key in value) {
      const val = value[key];
      if (typeof val === 'object') {
        stringifyValue[key] = JSON.stringify(val);
      } else {
        stringifyValue[key] = val;
      }
    }
    Object.assign(node.dataset, stringifyValue);
  } else {
    node.dataset = null;
  }
}

/**
 *
 * @type {Galaxy.View.BlueprintProperty}
 */
export const data_property = {
  type: 'reactive',
  key: 'data',
  getConfig: function (scope, value) {
    if (value !== null && (typeof value !== 'object' || value instanceof Array)) {
      throw new Error('data property should be an object with explicits keys:\n' + JSON.stringify(this.blueprint, null, '  '));
    }

    return {
      reactiveData: null,
      subjects: value,
      scope: scope
    };
  },
  install: function (config) {
    if (config.scope.data === config.subjects) {
      throw new Error('It is not allowed to use Scope.data as data value');
    }

    if (!this.blueprint.module) {
      config.reactiveData = bind_subjects_to_data(this, config.subjects, config.scope, true);
      const observer = new Observer(config.reactiveData);
      observer.onAll(() => {
        apply_node_dataset(this.node, config.reactiveData);
      });

      return;
    }

    Object.assign(this.data, config.subjects);
    return false;
  },
  update: function (config, value, expression) {
    if (expression) {
      value = expression();
    }

    if (config.subjects === value) {
      value = config.reactiveData;
    }

    apply_node_dataset(this.node, value);
  },
};
