/* global Galaxy */

(function (Galaxy) {
  const NAME = 'style';

  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP[NAME + '.config'] = {
    type: 'none'
  };

  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP[NAME] = {
    type: 'reactive',
    name: NAME
  };

  Galaxy.View.REACTIVE_BEHAVIORS[NAME] = {
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {string} attr
     * @param value
     */
    regex: null,
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

      const _this = this;
      const node = _this.node;

      if (expression) {
        value = expression();
      }

      if (typeof value === 'string') {
        return node.setAttribute('style', value);
      } else if (value instanceof Array) {
        return node.setAttribute('style', value.join(' '));
      } else if (value === null) {
        return node.removeAttribute('style');
      }

      const reactiveStyle = Galaxy.View.bindSubjectsToData(_this, value, data.scope, true);

      const observer = new Galaxy.Observer(reactiveStyle);
      observer.onAll(function (key, value, oldValue) {
        applyStyles.call(_this, reactiveStyle);
      });

      applyStyles.call(_this, reactiveStyle);
    }
  };

  function applyStyles(value) {
    if (value instanceof Object) {
      Object.assign(this.node.style, value);
    } else {
      this.node.setAttribute('style', value);
    }
  }
})(Galaxy);

