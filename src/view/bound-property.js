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
    this.expr = [];
    this.nodes = [];
  }

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {String} attributeName
   * @public
   */
  BoundProperty.prototype.addNode = function (node, attributeName, expression) {
    if (this.nodes.indexOf(node) === -1) {
      if (node instanceof Galaxy.GalaxyView.ViewNode) {
        node.addProperty(this, attributeName);
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

        var handler = {
          value: onChange,
          writable: true,
          configurable: true
        };

        GV.defineProp(node, '__onChange__', handler);
      }
      // var f = new Function('','return '+expression)
      this.expr.push(expression);
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
          if (this.expr[i]) {
            this.setValueFor(this.nodes[i], this.props[i], this.expr[i].call(), oldValue, scopeData);
          } else {
            this.setValueFor(this.nodes[i], this.props[i], value, oldValue, scopeData);
          }
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
    var newValue = value;

    if (host instanceof Galaxy.GalaxyView.ViewNode) {
      // var mutator = host.mutator[attributeName];
      //
      // if (mutator) {
      //   newValue = mutator.call(host, value, host.values[attributeName]);
      // }

      host.values[attributeName] = newValue;
      if (!host.setters[attributeName]) {
        console.info(host, attributeName, newValue);
      }

      host.setters[attributeName](newValue, oldValue, scopeData);
    } else {
      host[attributeName] = newValue;
      host.__onChange__(attributeName, newValue, oldValue, host);
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
