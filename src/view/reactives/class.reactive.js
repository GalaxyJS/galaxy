/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  GV.REACTIVE_BEHAVIORS['class'] = {
    regex: GV.BINDING_SYNTAX_REGEX,
    install: function (data) {

    },
    /**
     *
     * @param data
     * @param value
     * @param oldValue
     * @param scope
     * @this {Galaxy.GalaxyView.ViewNode}
     */
    apply: function (data, value, oldValue, expression, scope) {
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

      const clone = GV.bindSubjectsToData(value, scope, true);
// debugger;
      if (_this.setters.class.hasOwnProperty('data') && clone !== _this.setters.class['data']) {
        Galaxy.resetObjectTo(_this.setters.class['data'], clone);
      } else if (!_this.setters.class.hasOwnProperty('data')) {
        _this.setters.class['data'] = clone;
        // Object.defineProperty(_this, 'class.data', {
        //   value: clone,
        //   enumerable: false
        // });
      }

      node.setAttribute('class', []);
      const observer = new Galaxy.GalaxyObserver(clone);
      observer._node = _this.node;
      // debugger;
      observer.onAll(function (key, value, oldValue) {
        // debugger
        toggles.call(_this, key, value, oldValue, clone);
      });

      if (_this.schema.renderConfig && _this.schema.renderConfig.applyClassListAfterRender) {
        _this.rendered.then(function () {
          toggles.call(_this, null, true, false, clone);
        });
      } else {
        toggles.call(_this, null, true, false, clone);
      }

      // We add clone as a depended object to this node so when the node is destroyed,
      // its depended objects will be destroyed as well and prevents memory leak.
      _this.addDependedObject(clone);
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

