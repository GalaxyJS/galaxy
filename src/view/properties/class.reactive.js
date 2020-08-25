/* global Galaxy */

(function (Galaxy) {
  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  Galaxy.View.REACTIVE_BEHAVIORS['class'] = {
    regex: Galaxy.View.BINDING_SYNTAX_REGEX,
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
      const _this = this;
      const node = _this.node;

      if (expression) {
        value = expression();
      }

      const oldClassList = _this.node.className.classList;
      if (typeof value === 'string') {
        _this.notifyObserver('classList', value.split(' '), oldClassList);
        return node.setAttribute('class', value);
      } else if (value instanceof Array) {
        _this.notifyObserver('classList', value, oldClassList);
        return node.setAttribute('class', value.join(' '));
      } else if (value === null || value === undefined) {
        _this.notifyObserver('classList', [], oldClassList);
        return node.removeAttribute('class');
      }

      node.setAttribute('class', []);
      // when value is an object
      const clone = Galaxy.View.bindSubjectsToData(_this, value, data.scope, true);
      const observer = new Galaxy.Observer(clone);

      if (_this.schema.renderConfig && _this.schema.renderConfig.applyClassListAfterRender) {
        const items = Object.getOwnPropertyDescriptors(clone);
        const staticClasses = {};
        for (let key in items) {
          const item = items[key];
          if (item.enumerable && !item.hasOwnProperty('get')) {
            staticClasses[key] = clone[key];
          }
        }

        applyClasses.call(_this, '*', true, false, staticClasses);

        _this.rendered.then(function () {
          applyClasses.call(_this, '*', true, false, clone);

          observer.onAll(function (key, value, oldValue) {
            applyClasses.call(_this, key, value, oldValue, clone);
          });
        });
      } else {
        observer.onAll(function (key, value, oldValue) {
          applyClasses.call(_this, key, value, oldValue, clone);
        });

        applyClasses.call(_this, '*', true, false, clone);
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
    // debugger;
    _this.notifyObserver('class', newClasses, oldClasses);
    // _this.sequences.classList.nextAction(function () {
    _this.node.setAttribute('class', newClasses.join(' '));
    _this.notifyObserver('classList', newClasses, oldClasses);
    // });
  }
})(Galaxy);

