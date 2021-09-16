/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['class'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['class'] = {
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

      const viewNode = this;
      // when value is an object
      const reactiveClasses = config.reactiveClasses = G.View.bindSubjectsToData(viewNode, config.subjects, config.scope, true);
      const observer = config.observer = new G.Observer(reactiveClasses);
      if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        viewNode.rendered.then(function () {
          applyClasses(viewNode, reactiveClasses);
          observer.onAll((key, value, oldValue) => {
            applyClasses(viewNode, reactiveClasses);
          });
        });
      } else {
        observer.onAll((key, value, oldValue) => {
          applyClasses(viewNode, reactiveClasses);
        });
      }

      return true;
    },
    /**
     *
     * @param config
     * @param value
     * @param oldValue
     * @param expression
     * @this {Galaxy.View.ViewNode}
     */
    update: function (config, value, oldValue, expression) {
      if (this.virtual) {
        return;
      }

      /** @type Galaxy.View.ViewNode */
      const viewNode = this;
      const node = viewNode.node;

      if (expression) {
        value = expression();
      }

      if (typeof value === 'string') {
        return node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return node.setAttribute('class', value.join(' '));
      } else if (value === null || value === undefined) {
        return node.removeAttribute('class');
      }

      if (config.subjects === value) {
        value = config.reactiveClasses;
      }

      // when value is an object
      if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        viewNode.rendered.then(function () {
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
    const currentClasses = viewNode.node.getAttribute('class') || [];
    const newClasses = getClasses(classes);
    if (JSON.stringify(currentClasses) === JSON.stringify(newClasses)) {
      return;
    }

    viewNode.node.setAttribute('class', newClasses.join(' '));
  }
})(Galaxy);

