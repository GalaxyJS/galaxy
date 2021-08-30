/* global Galaxy */
(function (G) {
  G.View.REACTIVE_BEHAVIORS['style'] = true;
  G.View.NODE_BLUEPRINT_PROPERTY_MAP['style'] = {
    type: 'reactive',
    name: 'style',
    prepare: function (scope, value) {
      return {
        scope: scope,
        subjects: value,
        reactiveStyle: null
      };
    },
    install: function (config) {
      if (this.virtual || config.subjects === null || config.subjects instanceof Array || typeof config.subjects !== 'object') {
        return true;
      }

      const node = this.node;
      const reactiveStyle = config.reactiveStyle = G.View.bindSubjectsToData(this, config.subjects, config.scope, true);
      const observer = new G.Observer(reactiveStyle);
      observer.onAll(() => {
        setStyle(node, reactiveStyle);
      });

      return true;
    },
    /**
     *
     * @param config
     * @param value
     * @param oldValue
     * @param expression
     * @this {Galaxy.View.ViewNode}
     */
    apply: function (config, value, oldValue, expression) {
      if (this.virtual) {
        return;
      }

      const _this = this;
      const node = _this.node;

      if (expression) {
        value = expression();
      }

      if (typeof value === 'string') {
        return node.setAttribute('style', value);
      } else if (value instanceof Array) {
        return node.setAttribute('style', value.join(';'));
      }

      if (value instanceof Promise) {
        value.then(function (_value) {
          setStyle(node, _value);
        });
      } else if (value === null) {
        return node.removeAttribute('style');
      }

      if (config.subjects === value) {
        // return setStyle(node, config.reactiveStyle);
        value = config.reactiveStyle;
      }

      setStyle(node, value);
    }
  };

  function setStyle(node, value) {
    if (value instanceof Object) {
      for (let key in value) {
        const val = value[key];
        if (val instanceof Promise) {
          val.then((v) => {
            node.style[key] = v;
          });
        } else if (typeof val === 'function') {
          node.style[key] = val.call(node);
        } else {
          node.style[key] = val;
        }
      }
    } else {
      node.setAttribute('style', value);
    }
  }
})(Galaxy);

