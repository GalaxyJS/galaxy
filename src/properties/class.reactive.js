import { bind_subjects_to_data } from '../view.js';
import Observer from '../observer.js';

/**
 *
 * @type {Galaxy.View.BlueprintProperty}
 */
export const class_property = {
  type: 'reactive',
  key: 'class',
  getConfig: function (scope, value) {
    return {
      scope,
      subjects: value,
      reactiveClasses: null,
      observer: null,
    };
  },
  install: function (config) {
    if (this.virtual || config.subjects === null || config.subjects instanceof Array || typeof config.subjects !== 'object') {
      return true;
    }

    // when value is an object
    const viewNode = this;
    const reactiveClasses = config.reactiveClasses = bind_subjects_to_data(viewNode, config.subjects, config.scope, true);
    const observer = config.observer = new Observer(reactiveClasses);
    const animations = viewNode.blueprint.animations || {};
    const gsapExist = !!window.gsap.config;
    if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
      viewNode.rendered.then(() => {
        // ToDo: Don't know why this is here. It looks redundant
        // applyClasses(viewNode, reactiveClasses);
        observer.onAll((k) => {
          if (gsapExist && (animations['add:' + k] || animations['remove:' + k])) {
            return;
          }
          applyClasses(viewNode, reactiveClasses);
        });
      });
    } else {
      observer.onAll((k) => {
        if (gsapExist && (animations['add:' + k] || animations['remove:' + k])) {
          return;
        }
        applyClasses(viewNode, reactiveClasses);
      });
    }

    return true;
  },
  /**
   *
   * @param config
   * @param value
   * @param expression
   * @this Galaxy.ViewNode
   */
  update: function (config, value, expression) {
    if (this.virtual) {
      return;
    }

    const viewNode = this;
    const node = viewNode.node;

    if (expression) {
      value = expression();
    }

    if (typeof value === 'string' || value === null || value === undefined) {
      return node.className = value;
    } else if (value instanceof Array) {
      return node.className = value.join(' ');
    }

    if (config.subjects === value) {
      value = config.reactiveClasses;
    }

    // when value is an object
    if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
      viewNode.rendered.then(() => {
        applyClasses(viewNode, value);
      });
    } else {
      applyClasses(viewNode, value);
    }
  }
};

function getClasses(classes) {
  if (typeof classes === 'string') {
    return [classes];
  } else if (classes instanceof Array) {
    return classes;
  } else if (classes !== null && typeof classes === 'object') {
    let newClasses = [];

    for (let key in classes) {
      if (classes.hasOwnProperty(key) && classes[key]) {
        newClasses.push(key);
      }
    }

    return newClasses;
  }
}

function applyClasses(viewNode, classes) {
  const currentClasses = viewNode.node.className || [];
  const newClasses = getClasses(classes);
  if (JSON.stringify(currentClasses) === JSON.stringify(newClasses)) {
    return;
  }

  // G.View.create_in_next_frame(viewNode.index, (_next) => {
  viewNode.node.className = newClasses.join(' ');
  // _next();
  // });
}

