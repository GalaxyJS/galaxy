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
    onApply: function (cache, viewNode, value, oldValue, matches, context) {
      if (viewNode.virtual) {
        return;
      }

      if (typeof value === 'string') {
        return viewNode.node.setAttribute('class', value);
      } else if (value instanceof Array) {
        return viewNode.node.setAttribute('class', value.join(' '));
      } else if (value === null) {
        return viewNode.node.removeAttribute('class');
      }

      var clone = GV.bindSubjectsToData(value, context, true);

      if (viewNode.hasOwnProperty('[reactive/class]') && clone !== viewNode['[reactive/class]']) {
        Galaxy.resetObjectTo(viewNode['[reactive/class]'], clone);
      } else if (!viewNode.hasOwnProperty('[reactive/class]')) {
        Object.defineProperty(viewNode, '[reactive/class]', {
          value: clone,
          enumerable: false
        });
      }

      viewNode.node.setAttribute('class', []);
      var observer = new Galaxy.GalaxyObserver(clone);
      observer.onAll(function (key, value, oldValue) {
        toggles.call(viewNode, key, value, oldValue, clone);
      });

      if (viewNode.schema.renderConfig && viewNode.schema.renderConfig.applyClassListAfterRender) {
        viewNode.rendered.then(function () {
          toggles.call(viewNode, null, true, false, clone);
        });
      } else {
        toggles.call(viewNode, null, true, false, clone);
      }

      viewNode.addDependedObject(clone);
    }
  };

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

  function toggles(key, value, oldValue, classes) {
    if (oldValue === value) return;
    var oldClasses = this.node.getAttribute('class');
    oldClasses = oldClasses ? oldClasses.split(' ') : [];
    var newClasses = getClasses(classes);
    var _this = this;

    _this.notifyObserver('class', newClasses, oldClasses);
    _this.sequences[':class'].start().finish(function () {
      _this.node.setAttribute('class', newClasses.join(' '));
      _this.sequences[':class'].reset();
    });
  }
})(Galaxy.GalaxyView);

