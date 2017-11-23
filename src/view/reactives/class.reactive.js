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

      const _this = this;

      if (typeof value === 'string') {
        return _this.node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return _this.node.setAttribute('class', value.join(' '));
      } else if (value === null) {
        return _this.node.removeAttribute('class');
      }

      let clone = GV.bindSubjectsToData(value, context, true);

      if (_this.hasOwnProperty('[reactive/class]') && clone !== _this['[reactive/class]']) {
        Galaxy.resetObjectTo(_this['[reactive/class]'], clone);
      } else if (!_this.hasOwnProperty('[reactive/class]')) {
        Object.defineProperty(_this, '[reactive/class]', {
          value: clone,
          enumerable: false
        });
      }

      _this.node.setAttribute('class', []);
      let observer = new Galaxy.GalaxyObserver(clone);
      observer.onAll(function (key, value, oldValue) {
        toggles.call(_this, key, value, oldValue, clone);
      });

      if (_this.schema.renderConfig && _this.schema.renderConfig.applyClassListAfterRender) {
        _this.rendered.then(function () {
          toggles.call(_this, null, true, false, clone);
        });
      } else {
        toggles.call(_this, null, true, false, clone);
      }

      _this.addDependedObject(clone);
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

