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
    bind: function (viewNode, scopeData, matches) {

    },
    onApply: function (cache, viewNode, value, oldValue, matches, scopeData) {
      if (viewNode.virtual) {
        return;
      }

      if (typeof value !== 'object' || value === null) {
        return viewNode.node.setAttribute('class', value);
      }

      var keys = Object.keys(value);
      var attributeName;
      var attributeValue;
      var clone = GV.createClone(value);

      for (var i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = value[attributeName];

        var bindings = GV.getBindings(attributeValue);
        if (bindings.variableNamePaths) {
          viewNode.root.makeBinding(clone, scopeData, attributeName, bindings.variableNamePaths, bindings.isExpression);
        }
      }

      if (viewNode.hasOwnProperty('[reactive/class]') && clone !== viewNode['[reactive/class]']) {
        Galaxy.resetObjectTo(viewNode['[reactive/class]'], clone);
      } else if (!viewNode.hasOwnProperty('[reactive/class]')) {
        Object.defineProperty(viewNode, '[reactive/class]', {
          value: clone,
          enumerable: false
        });
      }

      viewNode.node.setAttribute('class', getClasses(clone).join(' '));
      clone.__onChange__ = toggles.bind(viewNode);
      toggles.call(viewNode, null, true, false, clone);
      viewNode.addDependedObject(clone);
    }
  };

  function toggles(key, value, oldValue, classes) {
    if (oldValue === value) return;
    var oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    var newClasses = getClasses(classes);
    var _this = this;

    _this.callWatchers('class', newClasses, oldClasses);
    _this.sequences[':class'].start().finish(function () {
      _this.node.setAttribute('class', newClasses.join(' '));
      _this.sequences[':class'].reset();
    });

  }

  function getClasses(obj) {
    if (typeof classes === 'string') {
      return [obj];
    } else if (obj instanceof Array) {
      return obj;
    } else if (obj !== null && typeof obj === 'object') {
      var newClasses = [];

      for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key]) newClasses.push(key);
      }

      return newClasses;
    }
  }
})(Galaxy.GalaxyView);

