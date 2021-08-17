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

      const oldClassList = viewNode.node.classList;
      if (typeof value === 'string') {
        viewNode.notifyObserver('classList', value.split(' '), oldClassList);
        return node.setAttribute('class', value);
      } else if (value instanceof Array) {
        viewNode.notifyObserver('classList', value, oldClassList);
        return node.setAttribute('class', value.join(' '));
      } else if (value === null || value === undefined) {
        viewNode.notifyObserver('classList', [], oldClassList);
        return node.removeAttribute('class');
      }

      node.setAttribute('class', []);
      // when value is an object
      const clone = G.View.bindSubjectsToData(viewNode, value, data.scope, true);
      const observer = new G.Observer(clone);

      if (viewNode.blueprint.renderConfig && viewNode.blueprint.renderConfig.applyClassListAfterRender) {
        const items = Object.getOwnPropertyDescriptors(clone);
        const staticClasses = {};
        for (let key in items) {
          const item = items[key];
          if (item.enumerable && !item.hasOwnProperty('get')) {
            staticClasses[key] = clone[key];
          }
        }

        applyClasses.call(viewNode, '*', true, false, staticClasses);

        viewNode.rendered.then(function () {
          applyClasses.call(viewNode, '*', true, false, clone);

          observer.onAll(function (key, value, oldValue) {
            applyClasses.call(viewNode, key, value, oldValue, clone);
          });
        });
      } else {
        observer.onAll(function (key, value, oldValue) {
          applyClasses.call(viewNode, key, value, oldValue, clone);
        });

        applyClasses.call(viewNode, '*', true, false, clone);
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

  function applyClasses(key, value, oldValue, classes) {
    if (oldValue === value) {
      return;
    }
    const viewNode = this;

    let oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    const newClasses = getClasses(classes);

    viewNode.notifyObserver('class', newClasses, oldClasses);
    viewNode.node.setAttribute('class', newClasses.join(' '));
    viewNode.notifyObserver('classList', newClasses, oldClasses);
  }
})(Galaxy);

