/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  GV.REACTIVE_BEHAVIORS['class'] = {
    regex: GV.BINDING_SYNTAX_REGEX,
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

      if (typeof value === 'string') {
        return node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return node.setAttribute('class', value.join(' '));
      } else if (value === null) {
        return node.removeAttribute('class');
      }

      node.setAttribute('class', []);

      // when value is an object
      const clone = GV.bindSubjectsToData(viewNode, value, data.scope, true);
      const observer = new Galaxy.Observer(clone);

      if (viewNode.schema.renderConfig && viewNode.schema.renderConfig.applyClassListAfterRender) {
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
    const _this = this;

    let oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    const newClasses = getClasses(classes);

    _this.notifyObserver('class', newClasses, oldClasses);
    _this.sequences[':class'].nextAction(function () {
      _this.node.setAttribute('class', newClasses.join(' '));
    });
  }
})(Galaxy.View);

