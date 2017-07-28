/* global Galaxy */

(function (GV) {
  GV.NODE_SCHEMA_PROPERTY_MAP['class'] = {
    type: 'reactive',
    name: 'class'
  };

  GV.REACTIVE_BEHAVIORS['class'] = {
    regex: /^\[\s*([^\[\]]*)\s*\]$/,
    bind: function (viewNode, scopeData, matches) {
    },
    onApply: function (cache, viewNode, value, matches, scopeData) {
      if (viewNode.virtual) {
        return;
      }

      if (typeof value !== 'object' || value === null) {
        return viewNode.node.setAttribute('class', value);
      }

      var keys = Object.keys(value);
      var bind;
      var attributeName;
      var attributeValue;
      var type;
      var clone = GV.createClone(value);

      for (var i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = value[attributeName];
        bind = null;
        type = typeof(attributeValue);

        if (type === 'string') {
          bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
        } else {
          bind = null;
        }

        if (bind) {
          viewNode.root.makeBinding(clone, scopeData, attributeName, bind[1]);
        }
      }

      if (viewNode.hasOwnProperty('__class__') && clone !== viewNode.__class__) {
        Galaxy.resetObjectTo(viewNode.__class__, clone);
      } else if (!viewNode.hasOwnProperty('__class__')) {
        Object.defineProperty(viewNode, '__class__', {
          value: clone,
          enumerable: false
        });
      }

      clone.__onChange__ = setValue.bind(viewNode);
      clone.__onChange__(true, false, clone);

      viewNode.addDependedObject(clone);
    }
  };

  function setValue(value, oldValue, classes) {
    if (oldValue === value) return;
    // debugger;

    if (typeof classes === 'string') {
      this.node.setAttribute('class', classes);
    } else if (classes instanceof Array) {
      this.node.setAttribute('class', classes.join(' '));
    } else if (classes !== null && typeof classes === 'object') {
      var temp = [];
      for (var key in classes) {
        if (classes.hasOwnProperty(key) && classes[key]) temp.push(key);
      }

      this.node.setAttribute('class', temp.join(' '));
    }
  }
})(Galaxy.GalaxyView);

