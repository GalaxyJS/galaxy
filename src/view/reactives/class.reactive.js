/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  GV.REACTIVE_BEHAVIORS['class'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    /**
     *
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param scopeData
     * @param matches
     */
    bind: function (scopeData, matches) {

    },
    onApply: function (cache,  value, oldValue, context) {
      if (this.virtual) {
        return;
      }

      if (typeof value === 'string') {
        return this.node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return this.node.setAttribute('class', value.join(' '));
      } else if (value === null) {
        return this.node.removeAttribute('class');
      }

      let clone = GV.bindSubjectsToData(value, context, true);

      if (this.hasOwnProperty('[reactive/class]') && clone !== this['[reactive/class]']) {
        Galaxy.resetObjectTo(this['[reactive/class]'], clone);
      } else if (!this.hasOwnProperty('[reactive/class]')) {
        Object.defineProperty(this, '[reactive/class]', {
          value: clone,
          enumerable: false
        });
      }

      this.node.setAttribute('class', []);
      let observer = new Galaxy.GalaxyObserver(clone);
      observer.onAll(function (key, value, oldValue) {
        toggles.call(this, key, value, oldValue, clone);
      });

      if (this.schema.renderConfig && this.schema.renderConfig.applyClassListAfterRender) {
        this.rendered.then(function () {
          toggles.call(this, null, true, false, clone);
        });
      } else {
        toggles.call(this, null, true, false, clone);
      }

      this.addDependedObject(clone);
    }
  };

  function getClasses(obj) {
    if (typeof classes === 'string') {
      return [obj];
    } else if (obj instanceof Array) {
      return obj;
    } else if (obj !== null && typeof obj === 'object') {
      let newClasses = [];

      for (let key in obj) {
        if (obj.hasOwnProperty(key) && obj[key]) newClasses.push(key);
      }

      return newClasses;
    }
  }

  function toggles(key, value, oldValue, classes) {
    if (oldValue === value) return;
    let oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    let newClasses = getClasses(classes);
    let _this = this;

    _this.notifyObserver('class', newClasses, oldClasses);
    _this.sequences[':class'].start().finish(function () {
      _this.node.setAttribute('class', newClasses.join(' '));
      _this.sequences[':class'].reset();
    });
  }
})(Galaxy.GalaxyView);

