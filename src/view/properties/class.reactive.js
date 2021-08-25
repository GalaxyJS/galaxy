/* global Galaxy */
(function (G) {
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  G.View.REACTIVE_BEHAVIORS['class'] = {
    regex: G.View.BINDING_SYNTAX_REGEX,
    prepare: function (m, s) {
      return {
        scope: s
      };
    },
    install: function (data) {
      return true;
    },
    /**
     *
     * @param data
     * @param value
     * @param oldValue
     * @param expression
     * @this {Galaxy.View.ViewNode}
     */
    apply: function (data, value, oldValue, expression) {
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

      node.setAttribute('class', '');
      // when value is an object
      const clone = G.View.bindSubjectsToData(viewNode, value, data.scope, true);
      const observer = new G.Observer(clone);
      if (viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        const items = Object.getOwnPropertyDescriptors(clone);
        const staticClasses = {};
        for (let key in items) {
          const item = items[key];
          if (item.enumerable && !item.hasOwnProperty('get')) {
            staticClasses[key] = clone[key];
          }
        }

        applyClasses(viewNode, staticClasses);
        viewNode.rendered.then(function () {
          applyClasses(viewNode, clone);
          observer.onAll((key, value, oldValue) => {
            applyClasses(viewNode, clone);
          });
        });
      } else {
        applyClasses(viewNode, clone);
        observer.onAll((key, value, oldValue) => {
          applyClasses(viewNode, clone);
        });
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
    const currentClasses = viewNode.node.getAttribute('class');
    const newClasses = getClasses(classes);
    if (JSON.stringify(currentClasses) === JSON.stringify(newClasses)) {
      return;
    }

    viewNode.node.setAttribute('class', newClasses.join(' '));
  }
})(Galaxy);

