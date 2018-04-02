/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  GV.REACTIVE_BEHAVIORS['class'] = {
    regex: GV.BINDING_SYNTAX_REGEX,
    prepareData: function (m, s) {
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
     * @this {Galaxy.GalaxyView.ViewNode}
     */
    apply: function (data, value, oldValue, expression) {
      if (this.virtual) {
        return;
      }

      const _this = this;
      const node = _this.node;

      if (typeof value === 'string') {
        return node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return node.setAttribute('class', value.join(' '));
      } else if (value === null) {
        return node.removeAttribute('class');
      }

      // TODO: This should happen in the install
      const clone = GV.bindSubjectsToData(_this, value, data.scope, true);

      node.setAttribute('class', []);
      const observer = new Galaxy.GalaxyObserver(clone);

      observer.onAll(function (key, value, oldValue) {
        toggles.call(_this, key, value, oldValue, clone);
      });

      if (_this.schema.renderConfig && _this.schema.renderConfig.applyClassListAfterRender) {
        _this.rendered.then(function () {
          toggles.call(_this, '*', true, false, clone);
        });
      } else {
        toggles.call(_this, '*', true, false, clone);
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

  function toggles(key, value, oldValue, classes) {
    if (oldValue === value) {
      return;
    }
    let oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    let newClasses = getClasses(classes);
    let _this = this;

    _this.notifyObserver('class', newClasses, oldClasses);
    // _this.sequences[':class'].start().finish(function () {
    _this.node.setAttribute('class', newClasses.join(' '));
    //   _this.sequences[':class'].reset();
    // });
  }
})(Galaxy.GalaxyView);

