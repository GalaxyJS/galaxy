/* global Galaxy */

(function (GV) {

  /**
   *
   * @returns {Galaxy.GalaxyView.BoundProperty}
   */
  GV.BoundProperty = BoundProperty;

  /**
   *
   * @param {String} name
   * @constructor
   */
  function BoundProperty(name, value) {
    /**
     * @public
     * @type {String} Name of the property
     */
    this.name = name;
    this.value = value;
    this.props = [];
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {String} attributeName
   * @param {Function} expression
   * @public
   */
  BoundProperty.prototype.addNode = function (node, attributeName, expression) {
    if (this.nodes.indexOf(node) === -1) {
      if (node instanceof Galaxy.GalaxyView.ViewNode) {
        node.installPropertySetter(this, attributeName, expression);
      } else {
        var onChange = (function () {
          var whens = {};
          var on = function (key, value, oldValue, context) {
            if (whens.hasOwnProperty(key)) {
              whens[key].call(context, value, oldValue);
            }
          };

          function f(key, value, oldValue, context) {
            on.call(this, key, value, oldValue, context);
          }

          f.when = function (key, action) {
            whens[key] = action;
          };

          return f;
        })();


        GV.defineProp(node, '__onChange__', {
          value: onChange,
          writable: true,
          configurable: true
        });
      }

      this.props.push(attributeName);
      this.nodes.push(node);
    }
  };

  BoundProperty.prototype.removeNode = function (node) {
    var nodeIndexInTheHost = this.nodes.indexOf(node);
    if (nodeIndexInTheHost !== -1) {
      this.nodes.splice(nodeIndexInTheHost, 1);
      this.props.splice(nodeIndexInTheHost, 1);
    }
  };

  BoundProperty.prototype.initValueFor = function (target, key, value, scopeData) {
    var oldValue = this.value;
    this.value = value;
    if (value instanceof Array) {
      var init = GV.createActiveArray(value, this.updateValue.bind(this));
      if (target instanceof GV.ViewNode) {
        target.values[key] = value;
        this.setUpdateFor(target, key, init);
      }
    } else {
      this.setValueFor(target, key, value, oldValue, scopeData);
    }
  };

  BoundProperty.prototype.setValue = function (value, scopeData) {
    if (value !== this.value) {
      var oldValue = this.value;
      this.value = value;
      if (value instanceof Array) {
        var oldChanges = GV.createActiveArray(value, this.updateValue.bind(this));
        this.updateValue({type: 'reset', params: value, original: value}, oldChanges);
      } else {
        for (var i = 0, len = this.nodes.length; i < len; i++) {
          this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
        }
      }
    }
  };

  BoundProperty.prototype.updateValue = function (changes, oldChanges) {
    for (var i = 0, len = this.nodes.length; i < len; i++) {
      this.nodes[i].value = changes.original;
      this.setUpdateFor(this.nodes[i], this.props[i], changes, oldChanges);
    }
  };

  BoundProperty.prototype.setValueFor = function (host, attributeName, value, oldValue, scopeData) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.values[attributeName] = value;
      if (!host.setters[attributeName]) {
        console.info(host, attributeName, value);
      }

      host.setters[attributeName](value, oldValue, scopeData);
    } else {
      // var exp = host.__expressions__[attributeName];
      // var val = exp ? exp() : value;
      // debugger;
      host[attributeName] = value;
      host.__onChange__(attributeName, value, oldValue, host);
    }
  };

  BoundProperty.prototype.setUpdateFor = function (host, attributeName, changes, oldChanges) {
    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      host.setters[attributeName](changes);
    } else {
      host.__onChange__(attributeName, changes, oldChanges, host);
    }
  };

})(Galaxy.GalaxyView);
